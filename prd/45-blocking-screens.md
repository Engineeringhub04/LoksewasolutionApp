# 45. Blocking Screens (Update Required / No Internet / Maintenance Mode)

Full-screen blocking states driven by App Configuration remote config.

## 45.1 Update Required
- Trigger: installed version < Minimum Supported App Version
- Illustration + "Update Required" + Update Now (deep link to store)
- No dismiss/bypass; re-checks version on return.

## 45.2 No Internet
- Trigger: no connectivity with no usable cached session/content
- Illustration + "No Internet Connection" + Retry
- Auto background re-check; transitions away on restore.

## 45.3 Maintenance Mode
- Trigger: Maintenance Mode toggle in remote config
- Illustration + "Under Maintenance" + configurable message (remote)
- No bypass; periodic background re-check to exit automatically.
