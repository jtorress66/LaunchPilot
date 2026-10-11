# @launchpilot/application

Use cases: orchestration of domain rules and ports (load → decide → save → notify).

Rules: depend on `@launchpilot/domain` and `@launchpilot/ports` only, receive every port through the
constructor, return `Result<T, E>` and never throw for expected failures. No I/O, no frameworks.
