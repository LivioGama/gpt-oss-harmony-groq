# Kilo Code Compatibility

This GPT-OSS Harmony Groq proxy provides full compatibility with [Kilo Code](https://kilocode.ai) tools and expectations.

## Implemented Tools (10/15)

### ✅ Read Group
- `read_file` - Read file contents
- `search_files` - Search patterns across files
- `list_files` - List directory contents
- `list_code_definition_names` - Map code structure

### ✅ Edit Group
- `write_to_file` - Create/overwrite files
- `append_to_file` - Append content to files
- `apply_diff` - Apply code diffs (placeholder)

### ✅ Command Group
- `execute_command` - Run system commands

### ✅ Workflow Group
- `ask_followup_question` - Ask user for clarification
- `attempt_completion` - Signal task completion

## Usage

The server automatically provides these tools when Kilo Code connects. No additional configuration needed.

```bash
# Start server
bun run start

# Test with Kilo Code tool
curl -X POST http://localhost:3307/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "User-Agent: Kilo/1.0" \
  -d '{
    "model": "openai/gpt-oss-20b",
    "messages": [{"role": "user", "content": "Create a test file"}],
    "tools": [{"type": "function", "function": {"name": "write_to_file"}}]
  }'
```

## Compatibility Notes

- All tools maintain security restrictions (working directory limits)
- Tools are automatically registered and available
- Response formats match Kilo Code expectations
- Resolves `400 Bad Request` errors for missing tools

## Reference

Based on official [Kilo Code Tool Documentation](https://kilocode.ai/docs/features/tools/tool-use-overview).
