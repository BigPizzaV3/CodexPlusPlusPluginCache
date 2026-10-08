# Flower Flow Graph Tooling

Use `flower-flow-graph` as an optional read-only aid when it is already
available in the project, local tool environment, or an explicitly approved
artifact source. Do not block Flower application work when it is unavailable,
and do not download or install an undeclared binary without authorization.

## Agent workflow

1. Run source inspection from the repository root before making a structural
   Flow change when the CLI is available:

   ```text
   flower-flow-graph inspect --compact
   ```

   An approved executable JAR provides the equivalent entry point:

   ```text
   java -jar <flower-flow-graph.jar> inspect --project <repository-root> --compact
   ```

2. Use the JSON to locate Flow definitions, explicit Step ids, known
   transitions, partial structure, and source-confirmed Flow submissions.
3. Read the referenced Java source before changing it. Static analysis is
   best-effort evidence, not a replacement for source inspection.
4. Implement the requested Java and test changes through the normal Flower
   application workflow.
5. Run the host tests and `flower-check` where adopted.
6. Run the same inspection again and compare the resulting structure when the
   tool remains available.

## Human graph view

For a user who asks to see the graph, prefer a Maven goal already registered by
the project:

```text
mvn flower-flow-graph:serve
```

Otherwise use an explicitly approved published plugin coordinate or executable
JAR. The server must remain loopback-only and read-only. Do not expose it as an
operations endpoint.

For a Spring Boot host that explicitly wants the graph server to follow the
application lifecycle, select the optional development-only starter instead of
adding the Maven plugin artifact as an application dependency:

```xml
<dependency>
  <groupId>io.github.flowerjvm</groupId>
  <artifactId>flower-flow-graph-spring-boot-starter</artifactId>
  <version>0.1.1</version>
  <scope>runtime</scope>
</dependency>
```

Enable it only in a local or development profile:

```yaml
flower:
  flow-graph:
    enabled: true
    project-root: .
    port: 8790
```

The starter is disabled by default and starts the same loopback-only source
server, not an endpoint on the application's public HTTP port. Keep it disabled
or omit the dependency in production. Flower's runtime Console may link to the
local URL, but it remains a separate read-only runtime view.

## Boundaries

- Java source remains the source of truth.
- Treat unresolved and dynamic edges as unknown or partial; never invent them.
- A detected `Worker.submit(...)` relation is a separate Flow submission, not
  proof of nested lifecycle ownership.
- Do not use the graph tool to write application code, mutate a running Engine,
  signal a Flow, retry work, or advance ticks.
- Keep static source structure, runtime Console/dump state, and editable change
  drafts visibly separate.
