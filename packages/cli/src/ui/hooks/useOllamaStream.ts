/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type {
  Config,
  EditorType,
  OllamaClient,
  ServerOllamaChatCompressedEvent,
  ServerOllamaContentEvent as ContentEvent,
  ServerOllamaFinishedEvent,
  ServerOllamaStreamEvent as OllamaEvent,
  ThoughtSummary,
  ToolCallRequestInfo,
  OllamaErrorEventValue,
} from '@google/ollama-cli-core';
import {
  OllamaEventType as ServerOllamaEventType,
  getErrorMessage,
  isNodeError,
  MessageSenderType,
  logUserPrompt,
  GitService,
  UnauthorizedError,
  UserPromptEvent,
  DEFAULT_OLLAMA_FLASH_MODEL,
  logConversationFinishedEvent,
  ConversationFinishedEvent,
  ApprovalMode,
  parseAndFormatApiError,
  ToolConfirmationOutcome,
  promptIdContext,
  WRITE_FILE_TOOL_NAME,
  tokenLimit,
  debugLogger,
  runInDevTraceSpan,
} from '@google/ollama-cli-core';
import { type Part, type PartListUnion, FinishReason } from '@google/genai';
import type {
  HistoryItem,
  HistoryItemWithoutId,
  HistoryItemToolGroup,
  SlashCommandProcessorResult,
  HistoryItemModel,
} from '../types.js';
import { StreamingState, MessageType, ToolCallStatus } from '../types.js';
import { isAtCommand, isSlashCommand } from '../utils/commandUtils.js';
import { useShellCommandProcessor } from './shellCommandProcessor.js';
import { handleAtCommand } from './atCommandProcessor.js';
import { findLastSafeSplitPoint } from '../utils/markdownUtilities.js';
import { useStateAndRef } from './useStateAndRef.js';
import type { UseHistoryManagerReturn } from './useHistoryManager.js';
import { useLogger } from './useLogger.js';
import {
  useReactToolScheduler,
  mapToDisplay as mapTrackedToolCallsToDisplay,
  type TrackedToolCall,
  type TrackedCompletedToolCall,
  type TrackedCancelledToolCall,
  type TrackedWaitingToolCall,
} from './useReactToolScheduler.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { useSessionStats } from '../contexts/SessionContext.js';
import { useKeypress } from './useKeypress.js';
import type { LoadedSettings } from '../../config/settings.js';

enum StreamProcessingStatus {
  Completed,
  UserCancelled,
  Error,
}

const EDIT_TOOL_NAMES = new Set(['replace', WRITE_FILE_TOOL_NAME]);

function showCitations(settings: LoadedSettings): boolean {
  const enabled = settings?.merged?.ui?.showCitations;
  if (enabled !== undefined) {
    return enabled;
  }
  return true;
}

/**
 * Manages the Ollama stream, including user input, command processing,
 * API interaction, and tool call lifecycle.
 */
export const useOllamaStream = (
  ollamaClient: OllamaClient,
  history: HistoryItem[],
  addItem: UseHistoryManagerReturn['addItem'],
  config: Config,
  settings: LoadedSettings,
  onDebugMessage: (message: string) => void,
  handleSlashCommand: (
    cmd: PartListUnion,
  ) => Promise<SlashCommandProcessorResult | false>,
  shellModeActive: boolean,
  getPreferredEditor: () => EditorType | undefined,
  onAuthError: (error: string) => void,
  performMemoryRefresh: () => Promise<void>,
  modelSwitchedFromQuotaError: boolean,
  setModelSwitchedFromQuotaError: React.Dispatch<React.SetStateAction<boolean>>,
  onEditorClose: () => void,
  onCancelSubmit: () => void,
  setShellInputFocused: (value: boolean) => void,
  terminalWidth: number,
  terminalHeight: number,
  isShellFocused?: boolean,
) => {
  const [initError, setInitError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const turnCancelledRef = useRef(false);
  const activeQueryIdRef = useRef<string | null>(null);
  const [isResponding, setIsResponding] = useState<boolean>(false);
  const [thought, setThought] = useState<ThoughtSummary | null>(null);
  const [pendingHistoryItem, pendingHistoryItemRef, setPendingHistoryItem] =
    useStateAndRef<HistoryItemWithoutId | null>(null);
  const processedMemoryToolsRef = useRef<Set<string>>(new Set());
  const { startNewPrompt, getPromptCount } = useSessionStats();
  const storage = config.storage;
  const logger = useLogger(storage);
  const gitService = useMemo(() => {
    if (!config.getProjectRoot()) {
      return;
    }
    return new GitService(config.getProjectRoot(), storage);
  }, [config, storage]);

  const [
    toolCalls,
    scheduleToolCalls,
    markToolsAsSubmitted,
    setToolCallsForDisplay,
    cancelAllToolCalls,
  ] = useReactToolScheduler(
    async (completedToolCallsFromScheduler) => {
      // This onComplete is called when ALL scheduled tools for a given batch are done.
      if (completedToolCallsFromScheduler.length > 0) {
        // Add the final state of these tools to the history for display.
        addItem(
          mapTrackedToolCallsToDisplay(
            completedToolCallsFromScheduler as TrackedToolCall[],
          ),
          Date.now(),
        );

        // Clear the live-updating display now that the final state is in history.
        setToolCallsForDisplay([]);

        // Record tool calls with full metadata before sending responses.
        try {
          const currentModel =
            config.getOllamaClient().getCurrentSequenceModel() ??
            config.getModel();
          config
            .getOllamaClient()
            .getChat()
            .recordCompletedToolCalls(
              currentModel,
              completedToolCallsFromScheduler,
            );
        } catch (error) {
          debugLogger.warn(
            `Error recording completed tool call information: ${error}`,
          );
        }

        // Handle tool response submission immediately when tools complete
        await handleCompletedTools(
          completedToolCallsFromScheduler as TrackedToolCall[],
        );
      }
    },
    config,
    getPreferredEditor,
    onEditorClose,
  );

  const pendingToolCallGroupDisplay = useMemo(
    () =>
      toolCalls.length ? mapTrackedToolCallsToDisplay(toolCalls) : undefined,
    [toolCalls],
  );

  const activeToolPtyId = useMemo(() => {
    const executingShellTool = toolCalls?.find(
      (tc) =>
        tc.status === 'executing' && tc.request.name === 'run_shell_command',
    );
    if (executingShellTool) {
      return (executingShellTool as { pid?: number }).pid;
    }
    return undefined;
  }, [toolCalls]);

  const lastQueryRef = useRef<PartListUnion | null>(null);
  const lastPromptIdRef = useRef<string | null>(null);
  const loopDetectedRef = useRef(false);
  const [
    loopDetectionConfirmationRequest,
    setLoopDetectionConfirmationRequest,
  ] = useState<{
    onComplete: (result: { userSelection: 'disable' | 'keep' }) => void;
  } | null>(null);

  const onExec = useCallback(async (done: Promise<void>) => {
    setIsResponding(true);
    await done;
    setIsResponding(false);
  }, []);
  const { handleShellCommand, activeShellPtyId } = useShellCommandProcessor(
    addItem,
    setPendingHistoryItem,
    onExec,
    onDebugMessage,
    config,
    ollamaClient,
    setShellInputFocused,
    terminalWidth,
    terminalHeight,
  );

  const activePtyId = activeShellPtyId || activeToolPtyId;

  useEffect(() => {
    if (!activePtyId) {
      setShellInputFocused(false);
    }
  }, [activePtyId, setShellInputFocused]);

  const streamingState = useMemo(() => {
    if (toolCalls.some((tc) => tc.status === 'awaiting_approval')) {
      return StreamingState.WaitingForConfirmation;
    }
    if (
      isResponding ||
      toolCalls.some(
        (tc) =>
          tc.status === 'executing' ||
          tc.status === 'scheduled' ||
          tc.status === 'validating' ||
          ((tc.status === 'success' ||
            tc.status === 'error' ||
            tc.status === 'cancelled') &&
            !(tc as TrackedCompletedToolCall | TrackedCancelledToolCall)
              .responseSubmittedToOllama),
      )
    ) {
      return StreamingState.Responding;
    }
    return StreamingState.Idle;
  }, [isResponding, toolCalls]);

  useEffect(() => {
    if (
      config.getApprovalMode() === ApprovalMode.YOLO &&
      streamingState === StreamingState.Idle
    ) {
      const lastUserMessageIndex = history.findLastIndex(
        (item: HistoryItem) => item.type === MessageType.USER,
      );

      const turnCount =
        lastUserMessageIndex === -1 ? 0 : history.length - lastUserMessageIndex;

      if (turnCount > 0) {
        logConversationFinishedEvent(
          config,
          new ConversationFinishedEvent(config.getApprovalMode(), turnCount),
        );
      }
    }
  }, [streamingState, config, history]);

  const cancelOngoingRequest = useCallback(() => {
    if (
      streamingState !== StreamingState.Responding &&
      streamingState !== StreamingState.WaitingForConfirmation
    ) {
      return;
    }
    if (turnCancelledRef.current) {
      return;
    }
    turnCancelledRef.current = true;

    // A full cancellation means no tools have produced a final result yet.
    // This determines if we show a generic "Request cancelled" message.
    const isFullCancellation = !toolCalls.some(
      (tc) => tc.status === 'success' || tc.status === 'error',
    );

    // Ensure we have an abort controller, creating one if it doesn't exist.
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }

    // The order is important here.
    // 1. Fire the signal to interrupt any active async operations.
    abortControllerRef.current.abort();
    // 2. Call the imperative cancel to clear the queue of pending tools.
    cancelAllToolCalls(abortControllerRef.current.signal);

    if (pendingHistoryItemRef.current) {
      addItem(pendingHistoryItemRef.current, Date.now());
    }
    setPendingHistoryItem(null);

    // If it was a full cancellation, add the info message now.
    // Otherwise, we let handleCompletedTools figure out the next step,
    // which might involve sending partial results back to the model.
    if (isFullCancellation) {
      addItem(
        {
          type: MessageType.INFO,
          text: 'Request cancelled.',
        },
        Date.now(),
      );
      setIsResponding(false);
    }

    onCancelSubmit();
    setShellInputFocused(false);
  }, [
    streamingState,
    addItem,
    setPendingHistoryItem,
    onCancelSubmit,
    pendingHistoryItemRef,
    setShellInputFocused,
    cancelAllToolCalls,
    toolCalls,
  ]);

  useKeypress(
    (key) => {
      if (key.name === 'escape' && !isShellFocused) {
        cancelOngoingRequest();
      }
    },
    {
      isActive:
        streamingState === StreamingState.Responding ||
        streamingState === StreamingState.WaitingForConfirmation,
    },
  );

  const prepareQueryForOllama = useCallback(
    async (
      query: PartListUnion,
      userMessageTimestamp: number,
      abortSignal: AbortSignal,
      prompt_id: string,
    ): Promise<{
      queryToSend: PartListUnion | null;
      shouldProceed: boolean;
    }> => {
      if (turnCancelledRef.current) {
        return { queryToSend: null, shouldProceed: false };
      }
      if (typeof query === 'string' && query.trim().length === 0) {
        return { queryToSend: null, shouldProceed: false };
      }

      let localQueryToSendToOllama: PartListUnion | null = null;

      if (typeof query === 'string') {
        const trimmedQuery = query.trim();
        onDebugMessage(`User query: '${trimmedQuery}'`);
        await logger?.logMessage(MessageSenderType.USER, trimmedQuery);

        if (!shellModeActive) {
          // Handle UI-only commands first
          const slashCommandResult = isSlashCommand(trimmedQuery)
            ? await handleSlashCommand(trimmedQuery)
            : false;

          if (slashCommandResult) {
            switch (slashCommandResult.type) {
              case 'schedule_tool': {
                const { toolName, toolArgs } = slashCommandResult;
                const toolCallRequest: ToolCallRequestInfo = {
                  callId: `${toolName}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                  name: toolName,
                  args: toolArgs,
                  isClientInitiated: true,
                  prompt_id,
                };
                scheduleToolCalls([toolCallRequest], abortSignal);
                return { queryToSend: null, shouldProceed: false };
              }
              case 'submit_prompt': {
                localQueryToSendToOllama = slashCommandResult.content;

                return {
                  queryToSend: localQueryToSendToOllama,
                  shouldProceed: true,
                };
              }
              case 'handled': {
                return { queryToSend: null, shouldProceed: false };
              }
              default: {
                const unreachable: never = slashCommandResult;
                throw new Error(
                  `Unhandled slash command result type: ${unreachable}`,
                );
              }
            }
          }
        }

        if (shellModeActive && handleShellCommand(trimmedQuery, abortSignal)) {
          return { queryToSend: null, shouldProceed: false };
        }

        // Handle @-commands (which might involve tool calls)
        if (isAtCommand(trimmedQuery)) {
          const atCommandResult = await handleAtCommand({
            query: trimmedQuery,
            config,
            addItem,
            onDebugMessage,
            messageId: userMessageTimestamp,
            signal: abortSignal,
          });

          // Add user's turn after @ command processing is done.
          addItem(
            { type: MessageType.USER, text: trimmedQuery },
            userMessageTimestamp,
          );

          if (!atCommandResult.shouldProceed) {
            return { queryToSend: null, shouldProceed: false };
          }
          localQueryToSendToOllama = atCommandResult.processedQuery;
        } else {
          // Normal query for Ollama
          addItem(
            { type: MessageType.USER, text: trimmedQuery },
            userMessageTimestamp,
          );
          localQueryToSendToOllama = trimmedQuery;
        }
      } else {
        // It's a function response (PartListUnion that isn't a string)
        localQueryToSendToOllama = query;
      }

      if (localQueryToSendToOllama === null) {
        onDebugMessage(
          'Query processing resulted in null, not sending to Ollama.',
        );
        return { queryToSend: null, shouldProceed: false };
      }
      return { queryToSend: localQueryToSendToOllama, shouldProceed: true };
    },
    [
      config,
      addItem,
      onDebugMessage,
      handleShellCommand,
      handleSlashCommand,
      logger,
      shellModeActive,
      scheduleToolCalls,
    ],
  );

  // --- Stream Event Handlers ---

  const handleContentEvent = useCallback(
    (
      eventValue: ContentEvent['value'],
      currentOllamaMessageBuffer: string,
      userMessageTimestamp: number,
    ): string => {
      if (turnCancelledRef.current) {
        // Prevents additional output after a user initiated cancel.
        return '';
      }
      let newOllamaMessageBuffer = currentOllamaMessageBuffer + eventValue;
      if (
        pendingHistoryItemRef.current?.type !== 'ollama' &&
        pendingHistoryItemRef.current?.type !== 'ollama_content'
      ) {
        if (pendingHistoryItemRef.current) {
          addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        }
        setPendingHistoryItem({ type: 'ollama', text: '' });
        newOllamaMessageBuffer = eventValue;
      }
      // Split large messages for better rendering performance. Ideally,
      // we should maximize the amount of output sent to <Static />.
      const splitPoint = findLastSafeSplitPoint(newOllamaMessageBuffer);
      if (splitPoint === newOllamaMessageBuffer.length) {
        // Update the existing message with accumulated content
        setPendingHistoryItem((item) => ({
          type: item?.type as 'ollama' | 'ollama_content',
          text: newOllamaMessageBuffer,
        }));
      } else {
        // This indicates that we need to split up this Ollama Message.
        // Splitting a message is primarily a performance consideration. There is a
        // <Static> component at the root of App.tsx which takes care of rendering
        // content statically or dynamically. Everything but the last message is
        // treated as static in order to prevent re-rendering an entire message history
        // multiple times per-second (as streaming occurs). Prior to this change you'd
        // see heavy flickering of the terminal. This ensures that larger messages get
        // broken up so that there are more "statically" rendered.
        const beforeText = newOllamaMessageBuffer.substring(0, splitPoint);
        const afterText = newOllamaMessageBuffer.substring(splitPoint);
        addItem(
          {
            type: pendingHistoryItemRef.current?.type as
              | 'ollama'
              | 'ollama_content',
            text: beforeText,
          },
          userMessageTimestamp,
        );
        setPendingHistoryItem({ type: 'ollama_content', text: afterText });
        newOllamaMessageBuffer = afterText;
      }
      return newOllamaMessageBuffer;
    },
    [addItem, pendingHistoryItemRef, setPendingHistoryItem],
  );

  const handleUserCancelledEvent = useCallback(
    (userMessageTimestamp: number) => {
      if (turnCancelledRef.current) {
        return;
      }
      if (pendingHistoryItemRef.current) {
        if (pendingHistoryItemRef.current.type === 'tool_group') {
          const updatedTools = pendingHistoryItemRef.current.tools.map(
            (tool) =>
              tool.status === ToolCallStatus.Pending ||
              tool.status === ToolCallStatus.Confirming ||
              tool.status === ToolCallStatus.Executing
                ? { ...tool, status: ToolCallStatus.Canceled }
                : tool,
          );
          const pendingItem: HistoryItemToolGroup = {
            ...pendingHistoryItemRef.current,
            tools: updatedTools,
          };
          addItem(pendingItem, userMessageTimestamp);
        } else {
          addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        }
        setPendingHistoryItem(null);
      }
      addItem(
        { type: MessageType.INFO, text: 'User cancelled the request.' },
        userMessageTimestamp,
      );
      setIsResponding(false);
      setThought(null); // Reset thought when user cancels
    },
    [addItem, pendingHistoryItemRef, setPendingHistoryItem, setThought],
  );

  const handleErrorEvent = useCallback(
    (eventValue: OllamaErrorEventValue, userMessageTimestamp: number) => {
      if (pendingHistoryItemRef.current) {
        addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        setPendingHistoryItem(null);
      }
      addItem(
        {
          type: MessageType.ERROR,
          text: parseAndFormatApiError(
            eventValue.error,
            config.getContentGeneratorConfig()?.authType,
            undefined,
            config.getModel(),
            DEFAULT_OLLAMA_FLASH_MODEL,
          ),
        },
        userMessageTimestamp,
      );
      setThought(null); // Reset thought when there's an error
    },
    [addItem, pendingHistoryItemRef, setPendingHistoryItem, config, setThought],
  );

  const handleCitationEvent = useCallback(
    (text: string, userMessageTimestamp: number) => {
      if (!showCitations(settings)) {
        return;
      }

      if (pendingHistoryItemRef.current) {
        addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        setPendingHistoryItem(null);
      }
      addItem({ type: MessageType.INFO, text }, userMessageTimestamp);
    },
    [addItem, pendingHistoryItemRef, setPendingHistoryItem, settings],
  );

  const handleFinishedEvent = useCallback(
    (event: ServerOllamaFinishedEvent, userMessageTimestamp: number) => {
      const finishReason = event.value.reason;
      if (!finishReason) {
        return;
      }

      const finishReasonMessages: Record<FinishReason, string | undefined> = {
        [FinishReason.FINISH_REASON_UNSPECIFIED]: undefined,
        [FinishReason.STOP]: undefined,
        [FinishReason.MAX_TOKENS]: 'Response truncated due to token limits.',
        [FinishReason.SAFETY]: 'Response stopped due to safety reasons.',
        [FinishReason.RECITATION]: 'Response stopped due to recitation policy.',
        [FinishReason.LANGUAGE]:
          'Response stopped due to unsupported language.',
        [FinishReason.BLOCKLIST]: 'Response stopped due to forbidden terms.',
        [FinishReason.PROHIBITED_CONTENT]:
          'Response stopped due to prohibited content.',
        [FinishReason.SPII]:
          'Response stopped due to sensitive personally identifiable information.',
        [FinishReason.OTHER]: 'Response stopped for other reasons.',
        [FinishReason.MALFORMED_FUNCTION_CALL]:
          'Response stopped due to malformed function call.',
        [FinishReason.IMAGE_SAFETY]:
          'Response stopped due to image safety violations.',
        [FinishReason.UNEXPECTED_TOOL_CALL]:
          'Response stopped due to unexpected tool call.',
      };

      const message = finishReasonMessages[finishReason];
      if (message) {
        addItem(
          {
            type: 'info',
            text: `⚠️  ${message}`,
          },
          userMessageTimestamp,
        );
      }
    },
    [addItem],
  );

  const handleChatCompressionEvent = useCallback(
    (
      eventValue: ServerOllamaChatCompressedEvent['value'],
      userMessageTimestamp: number,
    ) => {
      if (pendingHistoryItemRef.current) {
        addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        setPendingHistoryItem(null);
      }
      return addItem(
        {
          type: 'info',
          text:
            `IMPORTANT: This conversation exceeded the compress threshold. ` +
            `A compressed context will be sent for future messages (compressed from: ` +
            `${eventValue?.originalTokenCount ?? 'unknown'} to ` +
            `${eventValue?.newTokenCount ?? 'unknown'} tokens).`,
        },
        Date.now(),
      );
    },
    [addItem, pendingHistoryItemRef, setPendingHistoryItem],
  );

  const handleMaxSessionTurnsEvent = useCallback(
    () =>
      addItem(
        {
          type: 'info',
          text:
            `The session has reached the maximum number of turns: ${config.getMaxSessionTurns()}. ` +
            `Please update this limit in your setting.json file.`,
        },
        Date.now(),
      ),
    [addItem, config],
  );

  const handleContextWindowWillOverflowEvent = useCallback(
    (estimatedRequestTokenCount: number, remainingTokenCount: number) => {
      onCancelSubmit();

      const limit = tokenLimit(config.getModel());

      const isLessThan75Percent =
        limit > 0 && remainingTokenCount < limit * 0.75;

      let text = `Sending this message (${estimatedRequestTokenCount} tokens) might exceed the remaining context window limit (${remainingTokenCount} tokens).`;

      if (isLessThan75Percent) {
        text +=
          ' Please try reducing the size of your message or use the `/compress` command to compress the chat history.';
      }

      addItem(
        {
          type: 'info',
          text,
        },
        Date.now(),
      );
    },
    [addItem, onCancelSubmit, config],
  );

  const handleChatModelEvent = useCallback(
    (eventValue: string, userMessageTimestamp: number) => {
      if (!settings?.merged?.ui?.showModelInfoInChat) {
        return;
      }
      if (pendingHistoryItemRef.current) {
        addItem(pendingHistoryItemRef.current, userMessageTimestamp);
        setPendingHistoryItem(null);
      }
      addItem(
        {
          type: 'model',
          model: eventValue,
        } as HistoryItemModel,
        userMessageTimestamp,
      );
    },
    [addItem, pendingHistoryItemRef, setPendingHistoryItem, settings],
  );

  const processOllamaStreamEvents = useCallback(
    async (
      stream: AsyncIterable<OllamaEvent>,
      userMessageTimestamp: number,
      signal: AbortSignal,
    ): Promise<StreamProcessingStatus> => {
      let OllamaMessageBuffer = '';
      const toolCallRequests: ToolCallRequestInfo[] = [];
      for await (const event of stream) {
        switch (event.type) {
          case ServerOllamaEventType.Thought:
            setThought(event.value);
            break;
          case ServerOllamaEventType.Content:
            OllamaMessageBuffer = handleContentEvent(
              event.value,
              OllamaMessageBuffer,
              userMessageTimestamp,
            );
            break;
          case ServerOllamaEventType.ToolCallRequest:
            toolCallRequests.push(event.value);
            break;
          case ServerOllamaEventType.UserCancelled:
            handleUserCancelledEvent(userMessageTimestamp);
            break;
          case ServerOllamaEventType.Error:
            handleErrorEvent(event.value, userMessageTimestamp);
            break;
          case ServerOllamaEventType.ChatCompressed:
            handleChatCompressionEvent(event.value, userMessageTimestamp);
            break;
          case ServerOllamaEventType.ToolCallConfirmation:
          case ServerOllamaEventType.ToolCallResponse:
            // do nothing
            break;
          case ServerOllamaEventType.MaxSessionTurns:
            handleMaxSessionTurnsEvent();
            break;
          case ServerOllamaEventType.ContextWindowWillOverflow:
            handleContextWindowWillOverflowEvent(
              event.value.estimatedRequestTokenCount,
              event.value.remainingTokenCount,
            );
            break;
          case ServerOllamaEventType.Finished:
            handleFinishedEvent(
              event as ServerOllamaFinishedEvent,
              userMessageTimestamp,
            );
            break;
          case ServerOllamaEventType.Citation:
            handleCitationEvent(event.value, userMessageTimestamp);
            break;
          case ServerOllamaEventType.ModelInfo:
            handleChatModelEvent(event.value, userMessageTimestamp);
            break;
          case ServerOllamaEventType.LoopDetected:
            // handle later because we want to move pending history to history
            // before we add loop detected message to history
            loopDetectedRef.current = true;
            break;
          case ServerOllamaEventType.Retry:
          case ServerOllamaEventType.InvalidStream:
            // Will add the missing logic later
            break;
          default: {
            // enforces exhaustive switch-case
            const unreachable: never = event;
            return unreachable;
          }
        }
      }
      if (toolCallRequests.length > 0) {
        scheduleToolCalls(toolCallRequests, signal);
      }
      return StreamProcessingStatus.Completed;
    },
    [
      handleContentEvent,
      handleUserCancelledEvent,
      handleErrorEvent,
      scheduleToolCalls,
      handleChatCompressionEvent,
      handleFinishedEvent,
      handleMaxSessionTurnsEvent,
      handleContextWindowWillOverflowEvent,
      handleCitationEvent,
      handleChatModelEvent,
    ],
  );
  const submitQuery = useCallback(
    async (
      query: PartListUnion,
      options?: { isContinuation: boolean },
      prompt_id?: string,
    ) =>
      runInDevTraceSpan(
        { name: 'submitQuery' },
        async ({ metadata: spanMetadata }) => {
          spanMetadata.input = query;
          const queryId = `${Date.now()}-${Math.random()}`;
          activeQueryIdRef.current = queryId;
          if (
            (streamingState === StreamingState.Responding ||
              streamingState === StreamingState.WaitingForConfirmation) &&
            !options?.isContinuation
          )
            return;

          const userMessageTimestamp = Date.now();

          // Reset quota error flag when starting a new query (not a continuation)
          if (!options?.isContinuation) {
            setModelSwitchedFromQuotaError(false);
            config.setQuotaErrorOccurred(false);
          }

          abortControllerRef.current = new AbortController();
          const abortSignal = abortControllerRef.current.signal;
          turnCancelledRef.current = false;

          if (!prompt_id) {
            prompt_id = config.getSessionId() + '########' + getPromptCount();
          }
          return promptIdContext.run(prompt_id, async () => {
            const { queryToSend, shouldProceed } = await prepareQueryForOllama(
              query,
              userMessageTimestamp,
              abortSignal,
              prompt_id!,
            );

            if (!shouldProceed || queryToSend === null) {
              return;
            }

            if (!options?.isContinuation) {
              if (typeof queryToSend === 'string') {
                // logging the text prompts only for now
                const promptText = queryToSend;
                logUserPrompt(
                  config,
                  new UserPromptEvent(
                    promptText.length,
                    prompt_id!,
                    config.getContentGeneratorConfig()?.authType,
                    promptText,
                  ),
                );
              }
              startNewPrompt();
              setThought(null); // Reset thought when starting a new prompt
            }

            setIsResponding(true);
            setInitError(null);

            // Store query and prompt_id for potential retry on loop detection
            lastQueryRef.current = queryToSend;
            lastPromptIdRef.current = prompt_id!;

            try {
              const stream = ollamaClient.sendMessageStream(
                queryToSend,
                abortSignal,
                prompt_id!,
              );
              const processingStatus = await processOllamaStreamEvents(
                stream,
                userMessageTimestamp,
                abortSignal,
              );

              if (processingStatus === StreamProcessingStatus.UserCancelled) {
                return;
              }

              if (pendingHistoryItemRef.current) {
                addItem(pendingHistoryItemRef.current, userMessageTimestamp);
                setPendingHistoryItem(null);
              }
              if (loopDetectedRef.current) {
                loopDetectedRef.current = false;
                // Show the confirmation dialog to choose whether to disable loop detection
                setLoopDetectionConfirmationRequest({
                  onComplete: (result: {
                    userSelection: 'disable' | 'keep';
                  }) => {
                    setLoopDetectionConfirmationRequest(null);

                    if (result.userSelection === 'disable') {
                      config
                        .getOllamaClient()
                        .getLoopDetectionService()
                        .disableForSession();
                      addItem(
                        {
                          type: 'info',
                          text: `Loop detection has been disabled for this session. Retrying request...`,
                        },
                        Date.now(),
                      );

                      if (lastQueryRef.current && lastPromptIdRef.current) {
                        submitQuery(
                          lastQueryRef.current,
                          { isContinuation: true },
                          lastPromptIdRef.current,
                        );
                      }
                    } else {
                      addItem(
                        {
                          type: 'info',
                          text: `A potential loop was detected. This can happen due to repetitive tool calls or other model behavior. The request has been halted.`,
                        },
                        Date.now(),
                      );
                    }
                  },
                });
              }
            } catch (error: unknown) {
              spanMetadata.error = error;
              if (error instanceof UnauthorizedError) {
                onAuthError('Session expired or is unauthorized.');
              } else if (!isNodeError(error) || error.name !== 'AbortError') {
                addItem(
                  {
                    type: MessageType.ERROR,
                    text: parseAndFormatApiError(
                      getErrorMessage(error) || 'Unknown error',
                      config.getContentGeneratorConfig()?.authType,
                      undefined,
                      config.getModel(),
                      DEFAULT_OLLAMA_FLASH_MODEL,
                    ),
                  },
                  userMessageTimestamp,
                );
              }
            } finally {
              if (activeQueryIdRef.current === queryId) {
                setIsResponding(false);
              }
            }
          });
        },
      ),
    [
      streamingState,
      setModelSwitchedFromQuotaError,
      prepareQueryForOllama,
      processOllamaStreamEvents,
      pendingHistoryItemRef,
      addItem,
      setPendingHistoryItem,
      setInitError,
      ollamaClient,
      onAuthError,
      config,
      startNewPrompt,
      getPromptCount,
    ],
  );

  const handleApprovalModeChange = useCallback(
    async (newApprovalMode: ApprovalMode) => {
      // Auto-approve pending tool calls when switching to auto-approval modes
      if (
        newApprovalMode === ApprovalMode.YOLO ||
        newApprovalMode === ApprovalMode.AUTO_EDIT
      ) {
        let awaitingApprovalCalls = toolCalls.filter(
          (call): call is TrackedWaitingToolCall =>
            call.status === 'awaiting_approval',
        );

        // For AUTO_EDIT mode, only approve edit tools (replace, write_file)
        if (newApprovalMode === ApprovalMode.AUTO_EDIT) {
          awaitingApprovalCalls = awaitingApprovalCalls.filter((call) =>
            EDIT_TOOL_NAMES.has(call.request.name),
          );
        }

        // Process pending tool calls sequentially to reduce UI chaos
        for (const call of awaitingApprovalCalls) {
          if (call.confirmationDetails?.onConfirm) {
            try {
              await call.confirmationDetails.onConfirm(
                ToolConfirmationOutcome.ProceedOnce,
              );
            } catch (error) {
              debugLogger.warn(
                `Failed to auto-approve tool call ${call.request.callId}:`,
                error,
              );
            }
          }
        }
      }
    },
    [toolCalls],
  );

  const handleCompletedTools = useCallback(
    async (completedToolCallsFromScheduler: TrackedToolCall[]) => {
      const completedAndReadyToSubmitTools =
        completedToolCallsFromScheduler.filter(
          (
            tc: TrackedToolCall,
          ): tc is TrackedCompletedToolCall | TrackedCancelledToolCall => {
            const isTerminalState =
              tc.status === 'success' ||
              tc.status === 'error' ||
              tc.status === 'cancelled';

            if (isTerminalState) {
              const completedOrCancelledCall = tc as
                | TrackedCompletedToolCall
                | TrackedCancelledToolCall;
              return (
                completedOrCancelledCall.response?.responseParts !== undefined
              );
            }
            return false;
          },
        );

      // Finalize any client-initiated tools as soon as they are done.
      const clientTools = completedAndReadyToSubmitTools.filter(
        (t) => t.request.isClientInitiated,
      );
      if (clientTools.length > 0) {
        markToolsAsSubmitted(clientTools.map((t) => t.request.callId));
      }

      // Identify new, successful save_memory calls that we haven't processed yet.
      const newSuccessfulMemorySaves = completedAndReadyToSubmitTools.filter(
        (t) =>
          t.request.name === 'save_memory' &&
          t.status === 'success' &&
          !processedMemoryToolsRef.current.has(t.request.callId),
      );

      if (newSuccessfulMemorySaves.length > 0) {
        // Perform the refresh only if there are new ones.
        void performMemoryRefresh();
        // Mark them as processed so we don't do this again on the next render.
        newSuccessfulMemorySaves.forEach((t) =>
          processedMemoryToolsRef.current.add(t.request.callId),
        );
      }

      const ollamaTools = completedAndReadyToSubmitTools.filter(
        (t) => !t.request.isClientInitiated,
      );

      if (ollamaTools.length === 0) {
        return;
      }

      // If all the tools were cancelled, don't submit a response to Ollama.
      const allToolsCancelled = ollamaTools.every(
        (tc) => tc.status === 'cancelled',
      );

      if (allToolsCancelled) {
        // If the turn was cancelled via the imperative escape key flow,
        // the cancellation message is added there. We check the ref to avoid duplication.
        if (!turnCancelledRef.current) {
          addItem(
            {
              type: MessageType.INFO,
              text: 'Request cancelled.',
            },
            Date.now(),
          );
        }
        setIsResponding(false);

        if (ollamaClient) {
          // We need to manually add the function responses to the history
          // so the model knows the tools were cancelled.
          const combinedParts = ollamaTools.flatMap(
            (toolCall) => toolCall.response.responseParts,
          );
          ollamaClient.addHistory({
            role: 'user',
            parts: combinedParts,
          });
        }

        const callIdsToMarkAsSubmitted = ollamaTools.map(
          (toolCall) => toolCall.request.callId,
        );
        markToolsAsSubmitted(callIdsToMarkAsSubmitted);
        return;
      }

      const responsesToSend: Part[] = ollamaTools.flatMap(
        (toolCall) => toolCall.response.responseParts,
      );
      const callIdsToMarkAsSubmitted = ollamaTools.map(
        (toolCall) => toolCall.request.callId,
      );

      const prompt_ids = ollamaTools.map(
        (toolCall) => toolCall.request.prompt_id,
      );

      markToolsAsSubmitted(callIdsToMarkAsSubmitted);

      // Don't continue if model was switched due to quota error
      if (modelSwitchedFromQuotaError) {
        return;
      }

      submitQuery(
        responsesToSend,
        {
          isContinuation: true,
        },
        prompt_ids[0],
      );
    },
    [
      submitQuery,
      markToolsAsSubmitted,
      ollamaClient,
      performMemoryRefresh,
      modelSwitchedFromQuotaError,
      addItem,
    ],
  );

  const pendingHistoryItems = useMemo(
    () =>
      [pendingHistoryItem, pendingToolCallGroupDisplay].filter(
        (i) => i !== undefined && i !== null,
      ),
    [pendingHistoryItem, pendingToolCallGroupDisplay],
  );

  useEffect(() => {
    const saveRestorableToolCalls = async () => {
      if (!config.getCheckpointingEnabled()) {
        return;
      }
      const restorableToolCalls = toolCalls.filter(
        (toolCall) =>
          EDIT_TOOL_NAMES.has(toolCall.request.name) &&
          toolCall.status === 'awaiting_approval',
      );

      if (restorableToolCalls.length > 0) {
        const checkpointDir = storage.getProjectTempCheckpointsDir();

        if (!checkpointDir) {
          return;
        }

        try {
          await fs.mkdir(checkpointDir, { recursive: true });
        } catch (error) {
          if (!isNodeError(error) || error.code !== 'EEXIST') {
            onDebugMessage(
              `Failed to create checkpoint directory: ${getErrorMessage(error)}`,
            );
            return;
          }
        }

        for (const toolCall of restorableToolCalls) {
          const filePath = toolCall.request.args['file_path'] as string;
          if (!filePath) {
            onDebugMessage(
              `Skipping restorable tool call due to missing file_path: ${toolCall.request.name}`,
            );
            continue;
          }

          try {
            if (!gitService) {
              onDebugMessage(
                `Checkpointing is enabled but Git service is not available. Failed to create snapshot for ${filePath}. Ensure Git is installed and working properly.`,
              );
              continue;
            }

            let commitHash: string | undefined;
            try {
              commitHash = await gitService.createFileSnapshot(
                `Snapshot for ${toolCall.request.name}`,
              );
            } catch (error) {
              onDebugMessage(
                `Failed to create new snapshot: ${getErrorMessage(error)}. Attempting to use current commit.`,
              );
            }

            if (!commitHash) {
              commitHash = await gitService.getCurrentCommitHash();
            }

            if (!commitHash) {
              onDebugMessage(
                `Failed to create snapshot for ${filePath}. Checkpointing may not be working properly. Ensure Git is installed and the project directory is accessible.`,
              );
              continue;
            }

            const timestamp = new Date()
              .toISOString()
              .replace(/:/g, '-')
              .replace(/\./g, '_');
            const toolName = toolCall.request.name;
            const fileName = path.basename(filePath);
            const toolCallWithSnapshotFileName = `${timestamp}-${fileName}-${toolName}.json`;
            const clientHistory = await ollamaClient?.getHistory();
            const toolCallWithSnapshotFilePath = path.join(
              checkpointDir,
              toolCallWithSnapshotFileName,
            );

            await fs.writeFile(
              toolCallWithSnapshotFilePath,
              JSON.stringify(
                {
                  history,
                  clientHistory,
                  toolCall: {
                    name: toolCall.request.name,
                    args: toolCall.request.args,
                  },
                  commitHash,
                  filePath,
                },
                null,
                2,
              ),
            );
          } catch (error) {
            onDebugMessage(
              `Failed to create checkpoint for ${filePath}: ${getErrorMessage(
                error,
              )}. This may indicate a problem with Git or file system permissions.`,
            );
          }
        }
      }
    };
    saveRestorableToolCalls();
  }, [
    toolCalls,
    config,
    onDebugMessage,
    gitService,
    history,
    ollamaClient,
    storage,
  ]);

  return {
    streamingState,
    submitQuery,
    initError,
    pendingHistoryItems,
    thought,
    cancelOngoingRequest,
    pendingToolCalls: toolCalls,
    handleApprovalModeChange,
    activePtyId,
    loopDetectionConfirmationRequest,
  };
};
