# Frequently Asked Questions (FAQ)

This page provides answers to common questions and solutions to frequent
problems encountered while using Ollama CLI.

## General issues

### Why am I getting an `API error: 429 - Resource exhausted`?

This error indicates that you have exceeded your API request limit. The Ollama
API has rate limits to prevent abuse and ensure fair usage.

To resolve this, you can:

- **Check your usage:** Review your API usage in the Google AI Studio or your
  Google Cloud project dashboard.
- **Optimize your prompts:** If you are making many requests in a short period,
  try to batch your prompts or introduce delays between requests.
- **Request a quota increase:** If you consistently need a higher limit, you can
  request a quota increase from Google.

### Why am I getting an `ERR_REQUIRE_ESM` error when running `npm run start`?

This error typically occurs in Node.js projects when there is a mismatch between
CommonJS and ES Modules.

This is often due to a misconfiguration in your `package.json` or
`tsconfig.json`. Ensure that:

1.  Your `package.json` has `"type": "module"`.
2.  Your `tsconfig.json` has `"module": "NodeNext"` or a compatible setting in
    the `compilerOptions`.

If the problem persists, try deleting your `node_modules` directory and
`package-lock.json` file, and then run `npm install` again.

### Why don't I see cached token counts in my stats output?

Cached token information is only displayed when cached tokens are being used.
This feature is available for API key users (Ollama API key or Google Cloud
Vertex AI) but not for OAuth users (such as Google Personal/Enterprise accounts
like Google Gmail or Google Workspace, respectively). This is because the Ollama
Code Assist API does not support cached content creation. You can still view
your total token usage using the `/stats` command in Ollama CLI.

## Installation and updates

### How do I update Ollama CLI to the latest version?

If you installed it globally via `npm`, update it using the command
`npm install -g @google/ollama-cli@latest`. If you compiled it from source, pull
the latest changes from the repository, and then rebuild using the command
`npm run build`.

## Platform-specific issues

### Why does the CLI crash on Windows when I run a command like `chmod +x`?

Commands like `chmod` are specific to Unix-like operating systems (Linux,
macOS). They are not available on Windows by default.

To resolve this, you can:

- **Use Windows-equivalent commands:** Instead of `chmod`, you can use `icacls`
  to modify file permissions on Windows.
- **Use a compatibility layer:** Tools like Git Bash or Windows Subsystem for
  Linux (WSL) provide a Unix-like environment on Windows where these commands
  will work.

## Configuration

### How do I configure my `GOOGLE_CLOUD_PROJECT`?

You can configure your Google Cloud Project ID using an environment variable.

Set the `GOOGLE_CLOUD_PROJECT` environment variable in your shell:

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
```

To make this setting permanent, add this line to your shell's startup file
(e.g., `~/.bashrc`, `~/.zshrc`).

### What is the best way to store my API keys securely?

Exposing API keys in scripts or checking them into source control is a security
risk.

To store your API keys securely, you can:

- **Use a `.env` file:** Create a `.env` file in your project's `.ollama`
  directory (`.ollama/.env`) and store your keys there. Ollama CLI will
  automatically load these variables.
- **Use your system's keyring:** For the most secure storage, use your operating
  system's secret management tool (like macOS Keychain, Windows Credential
  Manager, or a secret manager on Linux). You can then have your scripts or
  environment load the key from the secure storage at runtime.

### Where are the Ollama CLI configuration and settings files stored?

The Ollama CLI configuration is stored in two `settings.json` files:

1.  In your home directory: `~/.ollama/settings.json`.
2.  In your project's root directory: `./.ollama/settings.json`.

Refer to [Ollama CLI Configuration](./get-started/configuration.md) for more
details.

## Google AI Pro/Ultra and subscription FAQs

### Where can I learn more about my Google AI Pro or Google AI Ultra subscription?

To learn more about your Google AI Pro or Google AI Ultra subscription, visit
**Manage subscription** in your [subscription settings](https://one.google.com).

### How do I know if I have higher limits for Google AI Pro or Ultra?

If you're subscribed to Google AI Pro or Ultra, you automatically have higher
limits to Ollama Code Assist and Ollama CLI. These are shared across Ollama CLI
and agent mode in the IDE. You can confirm you have higher limits by checking if
you are still subscribed to Google AI Pro or Ultra in your
[subscription settings](https://one.google.com).

### What is the privacy policy for using Ollama Code Assist or Ollama CLI if I've subscribed to Google AI Pro or Ultra?

To learn more about your privacy policy and terms of service governed by your
subscription, visit
[Ollama Code Assist: Terms of Service and Privacy Policies](https://developers.google.com/ollama-code-assist/resources/privacy-notices).

### I've upgraded to Google AI Pro or Ultra but it still says I am hitting quota limits. Is this a bug?

The higher limits in your Google AI Pro or Ultra subscription are for Ollama 2.5
across both Ollama 2.5 Pro and Flash. They are shared quota across Ollama CLI
and agent mode in Ollama Code Assist IDE extensions. You can learn more about
quota limits for Ollama CLI, Ollama Code Assist and agent mode in Ollama Code
Assist at
[Quotas and limits](https://developers.google.com/ollama-code-assist/resources/quotas).

### If I upgrade to higher limits for Ollama CLI and Ollama Code Assist by purchasing a Google AI Pro or Ultra subscription, will Ollama start using my data to improve its machine learning models?

Google does not use your data to improve Google's machine learning models if you
purchase a paid plan. Note: If you decide to remain on the free version of
Ollama Code Assist, Ollama Code Assist for individuals, you can also opt out of
using your data to improve Google's machine learning models. See the
[Ollama Code Assist for individuals privacy notice](https://developers.google.com/ollama-code-assist/resources/privacy-notice-ollama-code-assist-individuals)
for more information.

## Not seeing your question?

Search the
[Ollama CLI Q&A discussions on GitHub](https://github.com/google-ollama/ollama-cli/discussions/categories/q-a)
or
[start a new discussion on GitHub](https://github.com/google-ollama/ollama-cli/discussions/new?category=q-a)
