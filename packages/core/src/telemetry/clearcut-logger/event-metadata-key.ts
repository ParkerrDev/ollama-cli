/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Defines valid event metadata keys for Clearcut logging.
export enum EventMetadataKey {
  // Deleted enums: 24
  // Next ID: 129

  OLLAMA_CLI_KEY_UNKNOWN = 0,

  // ==========================================================================
  // Start Session Event Keys
  // ===========================================================================

  // Logs the model id used in the session.
  OLLAMA_CLI_START_SESSION_MODEL = 1,

  // Logs the embedding model id used in the session.
  OLLAMA_CLI_START_SESSION_EMBEDDING_MODEL = 2,

  // Logs the sandbox that was used in the session.
  OLLAMA_CLI_START_SESSION_SANDBOX = 3,

  // Logs the core tools that were enabled in the session.
  OLLAMA_CLI_START_SESSION_CORE_TOOLS = 4,

  // Logs the approval mode that was used in the session.
  OLLAMA_CLI_START_SESSION_APPROVAL_MODE = 5,

  // Logs whether an API key was used in the session.
  OLLAMA_CLI_START_SESSION_API_KEY_ENABLED = 6,

  // Logs whether the Vertex API was used in the session.
  OLLAMA_CLI_START_SESSION_VERTEX_API_ENABLED = 7,

  // Logs whether debug mode was enabled in the session.
  OLLAMA_CLI_START_SESSION_DEBUG_MODE_ENABLED = 8,

  // Logs the MCP servers that were enabled in the session.
  OLLAMA_CLI_START_SESSION_MCP_SERVERS = 9,

  // Logs whether user-collected telemetry was enabled in the session.
  OLLAMA_CLI_START_SESSION_TELEMETRY_ENABLED = 10,

  // Logs whether prompt collection was enabled for user-collected telemetry.
  OLLAMA_CLI_START_SESSION_TELEMETRY_LOG_USER_PROMPTS_ENABLED = 11,

  // Logs whether the session was configured to respect gitignore files.
  OLLAMA_CLI_START_SESSION_RESPECT_GITIGNORE = 12,

  // Logs the output format of the session.
  OLLAMA_CLI_START_SESSION_OUTPUT_FORMAT = 94,

  // ==========================================================================
  // User Prompt Event Keys
  // ===========================================================================

  // Logs the length of the prompt.
  OLLAMA_CLI_USER_PROMPT_LENGTH = 13,

  // ==========================================================================
  // Tool Call Event Keys
  // ===========================================================================

  // Logs the function name.
  OLLAMA_CLI_TOOL_CALL_NAME = 14,

  // Logs the MCP server name.
  OLLAMA_CLI_TOOL_CALL_MCP_SERVER_NAME = 95,

  // Logs the user's decision about how to handle the tool call.
  OLLAMA_CLI_TOOL_CALL_DECISION = 15,

  // Logs whether the tool call succeeded.
  OLLAMA_CLI_TOOL_CALL_SUCCESS = 16,

  // Logs the tool call duration in milliseconds.
  OLLAMA_CLI_TOOL_CALL_DURATION_MS = 17,

  // Do not use.
  DEPRECATED_OLLAMA_CLI_TOOL_ERROR_MESSAGE = 18,

  // Logs the tool call error type, if any.
  OLLAMA_CLI_TOOL_CALL_ERROR_TYPE = 19,

  // Logs the length of tool output
  OLLAMA_CLI_TOOL_CALL_CONTENT_LENGTH = 93,

  // ==========================================================================
  // Replace Tool Call Event Keys
  // ===========================================================================

  // Logs a smart edit tool strategy choice.
  OLLAMA_CLI_SMART_EDIT_STRATEGY = 109,

  // Logs a smart edit correction event.
  OLLAMA_CLI_SMART_EDIT_CORRECTION = 110,

  // Logs the reason for web fetch fallback.
  OLLAMA_CLI_WEB_FETCH_FALLBACK_REASON = 116,

  // ==========================================================================
  // GenAI API Request Event Keys
  // ===========================================================================

  // Logs the model id of the request.
  OLLAMA_CLI_API_REQUEST_MODEL = 20,

  // ==========================================================================
  // GenAI API Response Event Keys
  // ===========================================================================

  // Logs the model id of the API call.
  OLLAMA_CLI_API_RESPONSE_MODEL = 21,

  // Logs the status code of the response.
  OLLAMA_CLI_API_RESPONSE_STATUS_CODE = 22,

  // Logs the duration of the API call in milliseconds.
  OLLAMA_CLI_API_RESPONSE_DURATION_MS = 23,

  // Logs the input token count of the API call.
  OLLAMA_CLI_API_RESPONSE_INPUT_TOKEN_COUNT = 25,

  // Logs the output token count of the API call.
  OLLAMA_CLI_API_RESPONSE_OUTPUT_TOKEN_COUNT = 26,

  // Logs the cached token count of the API call.
  OLLAMA_CLI_API_RESPONSE_CACHED_TOKEN_COUNT = 27,

  // Logs the thinking token count of the API call.
  OLLAMA_CLI_API_RESPONSE_THINKING_TOKEN_COUNT = 28,

  // Logs the tool use token count of the API call.
  OLLAMA_CLI_API_RESPONSE_TOOL_TOKEN_COUNT = 29,

  // ==========================================================================
  // GenAI API Error Event Keys
  // ===========================================================================

  // Logs the model id of the API call.
  OLLAMA_CLI_API_ERROR_MODEL = 30,

  // Logs the error type.
  OLLAMA_CLI_API_ERROR_TYPE = 31,

  // Logs the status code of the error response.
  OLLAMA_CLI_API_ERROR_STATUS_CODE = 32,

  // Logs the duration of the API call in milliseconds.
  OLLAMA_CLI_API_ERROR_DURATION_MS = 33,

  // ==========================================================================
  // End Session Event Keys
  // ===========================================================================

  // Logs the end of a session.
  OLLAMA_CLI_END_SESSION_ID = 34,

  // ==========================================================================
  // Shared Keys
  // ===========================================================================

  // Logs the Prompt Id
  OLLAMA_CLI_PROMPT_ID = 35,

  // Logs the Auth type for the prompt, api responses and errors.
  OLLAMA_CLI_AUTH_TYPE = 36,

  // Logs the total number of Google accounts ever used.
  OLLAMA_CLI_GOOGLE_ACCOUNTS_COUNT = 37,

  // Logs the Surface from where the Ollama CLI was invoked, eg: VSCode.
  OLLAMA_CLI_SURFACE = 39,

  // Logs the session id
  OLLAMA_CLI_SESSION_ID = 40,

  // Logs the Ollama CLI version
  OLLAMA_CLI_VERSION = 54,

  // Logs the Ollama CLI Git commit hash
  OLLAMA_CLI_GIT_COMMIT_HASH = 55,

  // Logs the Ollama CLI OS
  OLLAMA_CLI_OS = 82,

  // Logs active user settings
  OLLAMA_CLI_USER_SETTINGS = 84,

  // ==========================================================================
  // Loop Detected Event Keys
  // ===========================================================================

  // Logs the type of loop detected.
  OLLAMA_CLI_LOOP_DETECTED_TYPE = 38,

  // ==========================================================================
  // Slash Command Event Keys
  // ===========================================================================

  // Logs the name of the slash command.
  OLLAMA_CLI_SLASH_COMMAND_NAME = 41,

  // Logs the subcommand of the slash command.
  OLLAMA_CLI_SLASH_COMMAND_SUBCOMMAND = 42,

  // Logs the status of the slash command (e.g. 'success', 'error')
  OLLAMA_CLI_SLASH_COMMAND_STATUS = 51,

  // ==========================================================================
  // Next Speaker Check Event Keys
  // ===========================================================================

  // Logs the finish reason of the previous streamGenerateContent response
  OLLAMA_CLI_RESPONSE_FINISH_REASON = 43,

  // Logs the result of the next speaker check
  OLLAMA_CLI_NEXT_SPEAKER_CHECK_RESULT = 44,

  // ==========================================================================
  // Malformed JSON Response Event Keys
  // ==========================================================================

  // Logs the model that produced the malformed JSON response.
  OLLAMA_CLI_MALFORMED_JSON_RESPONSE_MODEL = 45,

  // ==========================================================================
  // IDE Connection Event Keys
  // ===========================================================================

  // Logs the type of the IDE connection.
  OLLAMA_CLI_IDE_CONNECTION_TYPE = 46,

  // Logs AI added lines in edit/write tool response.
  OLLAMA_CLI_AI_ADDED_LINES = 47,

  // Logs AI removed lines in edit/write tool response.
  OLLAMA_CLI_AI_REMOVED_LINES = 48,

  // Logs user added lines in edit/write tool response.
  OLLAMA_CLI_USER_ADDED_LINES = 49,

  // Logs user removed lines in edit/write tool response.
  OLLAMA_CLI_USER_REMOVED_LINES = 50,

  // Logs AI added characters in edit/write tool response.
  OLLAMA_CLI_AI_ADDED_CHARS = 103,

  // Logs AI removed characters in edit/write tool response.
  OLLAMA_CLI_AI_REMOVED_CHARS = 104,

  // Logs user added characters in edit/write tool response.
  OLLAMA_CLI_USER_ADDED_CHARS = 105,

  // Logs user removed characters in edit/write tool response.
  OLLAMA_CLI_USER_REMOVED_CHARS = 106,

  // ==========================================================================
  // Kitty Sequence Overflow Event Keys
  // ===========================================================================

  // Do not use.
  DEPRECATED_OLLAMA_CLI_KITTY_TRUNCATED_SEQUENCE = 52,

  // Logs the length of the kitty sequence that overflowed.
  OLLAMA_CLI_KITTY_SEQUENCE_LENGTH = 53,

  // ==========================================================================
  // Conversation Finished Event Keys
  // ===========================================================================

  // Logs the approval mode of the session.
  OLLAMA_CLI_APPROVAL_MODE = 58,

  // Logs the number of turns
  OLLAMA_CLI_CONVERSATION_TURN_COUNT = 59,

  // Logs the number of tokens before context window compression.
  OLLAMA_CLI_COMPRESSION_TOKENS_BEFORE = 60,

  // Logs the number of tokens after context window compression.
  OLLAMA_CLI_COMPRESSION_TOKENS_AFTER = 61,

  // Logs tool type whether it is mcp or native.
  OLLAMA_CLI_TOOL_TYPE = 62,

  // Logs count of MCP servers in Start Session Event
  OLLAMA_CLI_START_SESSION_MCP_SERVERS_COUNT = 63,

  // Logs count of MCP tools in Start Session Event
  OLLAMA_CLI_START_SESSION_MCP_TOOLS_COUNT = 64,

  // Logs name of MCP tools as comma separated string
  OLLAMA_CLI_START_SESSION_MCP_TOOLS = 65,

  // ==========================================================================
  // Research Event Keys
  // ===========================================================================

  // Logs the research opt-in status (true/false)
  OLLAMA_CLI_RESEARCH_OPT_IN_STATUS = 66,

  // Logs the contact email for research participation
  OLLAMA_CLI_RESEARCH_CONTACT_EMAIL = 67,

  // Logs the user ID for research events
  OLLAMA_CLI_RESEARCH_USER_ID = 68,

  // Logs the type of research feedback
  OLLAMA_CLI_RESEARCH_FEEDBACK_TYPE = 69,

  // Logs the content of research feedback
  OLLAMA_CLI_RESEARCH_FEEDBACK_CONTENT = 70,

  // Logs survey responses for research feedback (JSON stringified)
  OLLAMA_CLI_RESEARCH_SURVEY_RESPONSES = 71,

  // ==========================================================================
  // File Operation Event Keys
  // ===========================================================================

  // Logs the programming language of the project.
  OLLAMA_CLI_PROGRAMMING_LANGUAGE = 56,

  // Logs the operation type of the file operation.
  OLLAMA_CLI_FILE_OPERATION_TYPE = 57,

  // Logs the number of lines in the file operation.
  OLLAMA_CLI_FILE_OPERATION_LINES = 72,

  // Logs the mimetype of the file in the file operation.
  OLLAMA_CLI_FILE_OPERATION_MIMETYPE = 73,

  // Logs the extension of the file in the file operation.
  OLLAMA_CLI_FILE_OPERATION_EXTENSION = 74,

  // ==========================================================================
  // Content Streaming Event Keys
  // ===========================================================================

  // Logs the error message for an invalid chunk.
  OLLAMA_CLI_INVALID_CHUNK_ERROR_MESSAGE = 75,

  // Logs the attempt number for a content retry.
  OLLAMA_CLI_CONTENT_RETRY_ATTEMPT_NUMBER = 76,

  // Logs the error type for a content retry.
  OLLAMA_CLI_CONTENT_RETRY_ERROR_TYPE = 77,

  // Logs the delay in milliseconds for a content retry.
  OLLAMA_CLI_CONTENT_RETRY_DELAY_MS = 78,

  // Logs the total number of attempts for a content retry failure.
  OLLAMA_CLI_CONTENT_RETRY_FAILURE_TOTAL_ATTEMPTS = 79,

  // Logs the final error type for a content retry failure.
  OLLAMA_CLI_CONTENT_RETRY_FAILURE_FINAL_ERROR_TYPE = 80,

  // Logs the total duration in milliseconds for a content retry failure.
  OLLAMA_CLI_CONTENT_RETRY_FAILURE_TOTAL_DURATION_MS = 81,

  // Logs the current nodejs version
  OLLAMA_CLI_NODE_VERSION = 83,

  // ==========================================================================
  // Extension Event Keys
  // ===========================================================================

  // Logs the name of the extension.
  OLLAMA_CLI_EXTENSION_NAME = 85,

  // Logs the name of the extension.
  OLLAMA_CLI_EXTENSION_ID = 121,

  // Logs the version of the extension.
  OLLAMA_CLI_EXTENSION_VERSION = 86,

  // Logs the previous version of the extension.
  OLLAMA_CLI_EXTENSION_PREVIOUS_VERSION = 117,

  // Logs the source of the extension.
  OLLAMA_CLI_EXTENSION_SOURCE = 87,

  // Logs the status of the extension install.
  OLLAMA_CLI_EXTENSION_INSTALL_STATUS = 88,

  // Logs the status of the extension uninstall
  OLLAMA_CLI_EXTENSION_UNINSTALL_STATUS = 96,

  // Logs the status of the extension uninstall
  OLLAMA_CLI_EXTENSION_UPDATE_STATUS = 118,

  // Logs the count of extensions in Start Session Event
  OLLAMA_CLI_START_SESSION_EXTENSIONS_COUNT = 119,

  // Logs the name of extensions as a comma-separated string
  OLLAMA_CLI_START_SESSION_EXTENSION_IDS = 120,

  // Logs the setting scope for an extension enablement.
  OLLAMA_CLI_EXTENSION_ENABLE_SETTING_SCOPE = 102,

  // Logs the setting scope for an extension disablement.
  OLLAMA_CLI_EXTENSION_DISABLE_SETTING_SCOPE = 107,

  // ==========================================================================
  // Tool Output Truncated Event Keys
  // ===========================================================================

  // Logs the original length of the tool output.
  OLLAMA_CLI_TOOL_OUTPUT_TRUNCATED_ORIGINAL_LENGTH = 89,

  // Logs the truncated length of the tool output.
  OLLAMA_CLI_TOOL_OUTPUT_TRUNCATED_TRUNCATED_LENGTH = 90,

  // Logs the threshold at which the tool output was truncated.
  OLLAMA_CLI_TOOL_OUTPUT_TRUNCATED_THRESHOLD = 91,

  // Logs the number of lines the tool output was truncated to.
  OLLAMA_CLI_TOOL_OUTPUT_TRUNCATED_LINES = 92,

  // ==========================================================================
  // Model Router Event Keys
  // ==========================================================================

  // Logs the outcome of a model routing decision (e.g., which route/model was
  // selected).
  OLLAMA_CLI_ROUTING_DECISION = 97,

  // Logs an event when the model router fails to make a decision or the chosen
  // route fails.
  OLLAMA_CLI_ROUTING_FAILURE = 98,

  // Logs the latency in milliseconds for the router to make a decision.
  OLLAMA_CLI_ROUTING_LATENCY_MS = 99,

  // Logs a specific reason for a routing failure.
  OLLAMA_CLI_ROUTING_FAILURE_REASON = 100,

  // Logs the source of the decision.
  OLLAMA_CLI_ROUTING_DECISION_SOURCE = 101,

  // Logs an event when the user uses the /model command.
  OLLAMA_CLI_MODEL_SLASH_COMMAND = 108,

  // ==========================================================================
  // Agent Event Keys
  // ==========================================================================

  // Logs the name of the agent.
  OLLAMA_CLI_AGENT_NAME = 111,

  // Logs the unique ID of the agent instance.
  OLLAMA_CLI_AGENT_ID = 112,

  // Logs the duration of the agent execution in milliseconds.
  OLLAMA_CLI_AGENT_DURATION_MS = 113,

  // Logs the number of turns the agent took.
  OLLAMA_CLI_AGENT_TURN_COUNT = 114,

  // Logs the reason for agent termination.
  OLLAMA_CLI_AGENT_TERMINATE_REASON = 115,

  // Logs the reason for an agent recovery attempt.
  OLLAMA_CLI_AGENT_RECOVERY_REASON = 122,

  // Logs the duration of an agent recovery attempt in milliseconds.
  OLLAMA_CLI_AGENT_RECOVERY_DURATION_MS = 123,

  // Logs whether the agent recovery attempt was successful.
  OLLAMA_CLI_AGENT_RECOVERY_SUCCESS = 124,

  // Logs whether the session is interactive.
  OLLAMA_CLI_INTERACTIVE = 125,

  // ==========================================================================
  // LLM Loop Check Event Keys
  // ==========================================================================

  // Logs the confidence score from the flash model loop check.
  OLLAMA_CLI_LLM_LOOP_CHECK_FLASH_CONFIDENCE = 126,

  // Logs the name of the main model used for the secondary loop check.
  OLLAMA_CLI_LLM_LOOP_CHECK_MAIN_MODEL = 127,

  // Logs the confidence score from the main model loop check.
  OLLAMA_CLI_LLM_LOOP_CHECK_MAIN_MODEL_CONFIDENCE = 128,

  // Logs the model that confirmed the loop.
  OLLAMA_CLI_LOOP_DETECTED_CONFIRMED_BY_MODEL = 129,
}
