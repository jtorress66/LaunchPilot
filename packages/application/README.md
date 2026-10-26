# @nuvantre/application

Use cases: orchestration of domain rules and ports (load → decide → save → notify).

Rules: depend on `@nuvantre/domain` and `@nuvantre/ports` only, receive every port through the
constructor, return `Result<T, E>` and never throw for expected failures. No I/O, no frameworks.
