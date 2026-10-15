# UI follow-ups

- Workspace initial loading: replace the generic content skeleton → page skeleton sequence with one page-owned skeleton that retains the final layout. Keep the shell's session placeholders limited to its header/sidebar; preserve authentication and authorization, and do not start protected requests before access is established. Refreshes must retain mounted controls and previous successful content. Verify slow-network direct loads and client navigation.
