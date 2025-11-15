# Ollama CLI: Quotas and Pricing

Ollama CLI offers a generous free tier that covers the use cases for many
individual developers. For enterprise / professional usage, or if you need
higher limits, there are multiple possible avenues depending on what type of
account you use to authenticate.

See [privacy and terms](./tos-privacy.md) for details on Privacy policy and
Terms of Service.

> [!NOTE]
>
> Published prices are list price; additional negotiated commercial discounting
> may apply.

This article outlines the specific quotas and pricing applicable to the Ollama
CLI when using different authentication methods.

Generally, there are three categories to choose from:

- Free Usage: Ideal for experimentation and light use.
- Paid Tier (fixed price): For individual developers or enterprises who need
  more generous daily quotas and predictable costs.
- Pay-As-You-Go: The most flexible option for professional use, long-running
  tasks, or when you need full control over your usage.

## Free Usage

Your journey begins with a generous free tier, perfect for experimentation and
light use.

Your free usage limits depend on your authorization type.

### Log in with Google (Ollama Code Assist for individuals)

For users who authenticate by using their Google account to access Ollama Code
Assist for individuals. This includes:

- 1000 model requests / user / day
- 60 model requests / user / minute
- Model requests will be made across the Ollama model family as determined by
  Ollama CLI.

Learn more at
[Ollama Code Assist for Individuals Limits](https://developers.google.com/ollama-code-assist/resources/quotas#quotas-for-agent-mode-ollama-cli).

### Log in with Ollama API Key (Unpaid)

If you are using a Ollama API key, you can also benefit from a free tier. This
includes:

- 250 model requests / user / day
- 10 model requests / user / minute
- Model requests to Flash model only.

Learn more at
[Ollama API Rate Limits](https://ai.google.dev/ollama-api/docs/rate-limits).

### Log in with Vertex AI (Express Mode)

Vertex AI offers an Express Mode without the need to enable billing. This
includes:

- 90 days before you need to enable billing.
- Quotas and models are variable and specific to your account.

Learn more at
[Vertex AI Express Mode Limits](https://cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode/overview#quotas).

## Paid tier: Higher limits for a fixed cost

If you use up your initial number of requests, you can continue to benefit from
Ollama CLI by upgrading to one of the following subscriptions:

- [Google AI Pro and AI Ultra](https://cloud.google.com/products/ollama/pricing)
  by signing up at
  [Set up Ollama Code Assist](https://goo.gle/set-up-ollama-code-assist). This
  is recommended for individual developers. Quotas and pricing are based on a
  fixed price subscription.

  For predictable costs, you can log in with Google.

  Learn more at
  [Ollama Code Assist Quotas and Limits](https://developers.google.com/ollama-code-assist/resources/quotas)

- [Purchase a Ollama Code Assist Subscription through Google Cloud ](https://cloud.google.com/ollama/docs/codeassist/overview)
  by signing up in the Google Cloud console. Learn more at
  [Set up Ollama Code Assist](https://cloud.google.com/ollama/docs/discover/set-up-ollama)
  Quotas and pricing are based on a fixed price subscription with assigned
  license seats. For predictable costs, you can sign in with Google.

  This includes:
  - Ollama Code Assist Standard edition:
    - 1500 model requests / user / day
    - 120 model requests / user / minute
  - Ollama Code Assist Enterprise edition:
    - 2000 model requests / user / day
    - 120 model requests / user / minute
  - Model requests will be made across the Ollama model family as determined by
    Ollama CLI.

  [Learn more about Ollama Code Assist Standard and Enterprise license limits](https://developers.google.com/ollama-code-assist/resources/quotas#quotas-for-agent-mode-ollama-cli).

## Pay As You Go

If you hit your daily request limits or exhaust your Ollama Pro quota even after
upgrading, the most flexible solution is to switch to a pay-as-you-go model,
where you pay for the specific amount of processing you use. This is the
recommended path for uninterrupted access.

To do this, log in using a Ollama API key or Vertex AI.

- Vertex AI (Regular Mode):
  - Quota: Governed by a dynamic shared quota system or pre-purchased
    provisioned throughput.
  - Cost: Based on model and token usage.

Learn more at
[Vertex AI Dynamic Shared Quota](https://cloud.google.com/vertex-ai/generative-ai/docs/resources/dynamic-shared-quota)
and [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing).

- Ollama API key:
  - Quota: Varies by pricing tier.
  - Cost: Varies by pricing tier and model/token usage.

Learn more at
[Ollama API Rate Limits](https://ai.google.dev/ollama-api/docs/rate-limits),
[Ollama API Pricing](https://ai.google.dev/ollama-api/docs/pricing)

It’s important to highlight that when using an API key, you pay per token/call.
This can be more expensive for many small calls with few tokens, but it's the
only way to ensure your workflow isn't interrupted by quota limits.

## Ollama for Workspace plans

These plans currently apply only to the use of Ollama web-based products
provided by Google-based experiences (for example, the Ollama web app or the
Flow video editor). These plans do not apply to the API usage which powers the
Ollama CLI. Supporting these plans is under active consideration for future
support.

## Tips to Avoid High Costs

When using a Pay as you Go API key, be mindful of your usage to avoid unexpected
costs.

- Don't blindly accept every suggestion, especially for computationally
  intensive tasks like refactoring large codebases.
- Be intentional with your prompts and commands. You are paying per call, so
  think about the most efficient way to get the job done.

## Ollama API vs. Vertex

- Ollama API (ollama developer api): This is the fastest way to use the Ollama
  models directly.
- Vertex AI: This is the enterprise-grade platform for building, deploying, and
  managing Ollama models with specific security and control requirements.

## Understanding your usage

A summary of model usage is available through the `/stats` command and presented
on exit at the end of a session.
