/**
 * Get help text for CLI commands
 */
export function getHelpText(): string {
	return `
Usage: ccflare-cli <command> [options]

Commands:
  add <name> [--mode <max|console>] [--tier <1|5|20>]
    Add a new Claude account using OAuth
    --mode: Account type (optional, will prompt if not provided)
    --tier: Account tier (1, 5, or 20) (optional, will prompt for Max accounts)

  add-openai <name> --api-key <key>
    Add a new OpenAI account using API key
    --api-key: Your OpenAI API key (required)

  list
    List all accounts with their details

  remove <name> [--force]
    Remove an account
    --force: Skip confirmation prompt

  pause <name>
    Pause an account to exclude it from load balancing

  resume <name>
    Resume a paused account to include it in load balancing

  reset-stats
    Reset request counts for all accounts

  clear-history
    Clear request history

  analyze
    Analyze database performance and index usage

  api-key:create <name> [--rpm <limit>] [--tpm <limit>] [--daily <limit>]
    Create a new API key for multi-user access
    --rpm: Requests per minute limit (optional)
    --tpm: Tokens per minute limit (optional)
    --daily: Daily request limit (optional)

  api-key:list
    List all API keys and their usage

  api-key:delete <name|id>
    Delete an API key

  api-key:enable <name|id>
    Enable an API key

  api-key:disable <name|id>
    Disable an API key

  help
    Show this help message

Examples:
  ccflare-cli add myaccount --mode max --tier 5
  ccflare-cli add-openai myopenai --api-key sk-...
  ccflare-cli list
  ccflare-cli remove myaccount
  ccflare-cli pause myaccount
  ccflare-cli resume myaccount
  ccflare-cli api-key:create production --daily 1000
  ccflare-cli api-key:list
`;
}
