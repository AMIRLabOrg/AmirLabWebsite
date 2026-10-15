# Workspace loading

- Removed the generic content skeleton. During authentication, a shared full-screen “Checking your session” status covers the shell, which is inert and hidden from assistive technology. Page content remains blank. Protected page components still mount only after authentication. Pages retain their existing component-native loading states.
- Preserve this rule: loading markup stays in real components. Do not introduce a second skeleton tree for page content.
- Refresh behavior remains unchanged: controls and previous successful results should remain mounted.
