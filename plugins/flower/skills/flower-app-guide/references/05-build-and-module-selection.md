# Host Build And Module Selection

Use this reference when creating or changing a Maven or Gradle host, choosing
Flower modules, configuring Spring Boot, or installing `flower-check`. Treat it
as a decision map, not a required bundle.

## Contents

- [Selection Rules](#selection-rules)
- [Published Modules](#published-modules)
- [Maven Setup](#maven-setup)
- [Gradle Kotlin DSL Setup](#gradle-kotlin-dsl-setup)
- [Spring Boot Minimum](#spring-boot-minimum)
- [Persistence And Observability](#persistence-and-observability)
- [Verification](#verification)

## Selection Rules

1. Inspect the existing build tool, Java level, Spring line, execution model,
   database, and test setup before editing the build.
2. Preserve compatible host dependency management and add only modules justified
   by the requirements.
3. Keep Flower modules on the guide's tested `0.1.3` release. For consumers,
   use Maven Central; do not substitute an unpublished development version or
   a neighboring source build.
4. Use ordinary `flower-core` unless event-driven execution, Spring-managed
   lifecycle, or another optional capability is actually required.
5. Do not add JDBC persistence, observability, evaluation, event-loop, Bloom,
   or Action Runtime merely because those modules exist.
6. If host code directly imports a module's public API, declare that module
   directly instead of relying only on an incidental transitive dependency.
7. State the modules selected, the requirements that selected them, and the
   optional modules deliberately omitted.

Flower Agent `0.2.0` and Flower AI Harness `0.1.3` were published against
Flower `0.1.2`. When either shares one host dependency graph with direct
Flower `0.1.3` modules or Action Runtime `0.3.3`, resolve one Flower line,
inspect the dependency tree, and run the selected Agent or Harness integration
path against the resolved version. Use Flower `0.1.3` only when that host
verification passes; describe the result as host-verified rather than changing
the upstream release's stated compatibility. If it fails, do not claim the
combination is supported or force Action Runtime onto Flower `0.1.2`.

Flower runtime, persistence, observability, testkit, and check artifacts target
Java 8. The Spring Boot starter requires Java 17 or newer and Spring Boot 3.x.
If Flower Action Runtime is selected, follow its separate Java 21 requirement.

## Published Modules

All Flower coordinates below use group `io.github.flowerjvm` and version
`0.1.3`.

| Requirement | Artifact or plugin | Add when | Leave out when |
| --- | --- | --- | --- |
| Tick-driven Flow/Step execution | `flower-core` | Ordinary workers can tick active flows cheaply | No Flower workflow is justified, or the Boot starter supplies the runtime |
| Spring-managed Engine and Worker lifecycle | `flower-spring-boot-starter` | A Boot 3.x host wants Flower auto-configuration | Plain Java or manual Spring wiring is preferred |
| Durable tick-flow checkpoints | `flower-persistence-jdbc` | Restart recovery requires a JDBC `FlowCheckpointStore` | In-memory/transient execution is sufficient |
| Event-driven waits | `flower-eventloop` | Many flows sleep until events, signals, approvals, callbacks, or deadlines | Ordinary non-blocking ticks are sufficient |
| Durable event-flow checkpoints | `flower-eventloop-persistence-jdbc` | Event-loop flows must recover after restart | Event-loop persistence is unnecessary |
| Logging, metrics, tracing, or dumps | `flower-observability` | The host registers the corresponding listener/helper | The host does not consume those helpers; the Boot starter already brings the module |
| Offline evaluation datasets and experiments | `flower-evaluation` | The host runs post-execution candidates through datasets, evaluators, comparisons, or JSONL result/feedback storage | Ordinary runtime tests and `flower-testkit` already cover the requirement |
| Deterministic test helpers | `flower-testkit` | Tests use `FlowTestHarness` or bundled fakes | The host intentionally uses equivalent manual test wiring |
| Maven build checks | `flower-check-maven-plugin` | A Maven Flower host should fail `verify` on unsafe patterns | The build is not Maven |
| Gradle build checks | plugin ID `io.github.flowerjvm.flower-check` | A Gradle Flower host should attach `flowerCheck` to `check` | The build is not Gradle |
| Checker acknowledgement annotations | `flower-check-annotations` | Source uses an official, documented acknowledgement annotation | No such annotation is needed |
| Direct checker CLI | `flower-check` | A build plugin cannot be used and a CLI integration is intentional | Prefer the Maven or Gradle plugin |

Release maturity matters in Flower `0.1.3`. `flower-core` is the stable center
of the release. `flower-eventloop` is experimental, and the event-loop
persistence, evaluation, testkit, and Flower Check lines are labeled MVP in
the release documentation. Pin the exact version, expect pre-1.0 API movement,
and validate an experimental/MVP module against the host's production
requirements before selecting it.

`flower-eventloop` is a separate execution line, not a drop-in replacement for
the ordinary Worker/Flow/Step model. Both may coexist only when distinct
workloads justify both.

When an application already uses Bloom `0.1.1`, the optional
`io.github.flowerjvm:bloom-flower-adapter:0.1.1` exposes Bloom as Flower's
`EventBus` SPI. Do not introduce Bloom solely to use Flower.

## Maven Setup

Maven Central is the default repository, so a released consumer needs no custom
`<repositories>` entry.

```xml
<properties>
    <flower.version>0.1.3</flower.version>
</properties>

<dependencies>
    <dependency>
        <groupId>io.github.flowerjvm</groupId>
        <artifactId>flower-core</artifactId>
        <version>${flower.version}</version>
    </dependency>
    <dependency>
        <groupId>io.github.flowerjvm</groupId>
        <artifactId>flower-testkit</artifactId>
        <version>${flower.version}</version>
        <scope>test</scope>
    </dependency>
</dependencies>
```

Keep the host's test framework and version management; `flower-testkit` does
not choose them. Add optional runtime artifacts from the table only after their
selection condition is met.

Configure Flower Check under `<build><plugins>`:

```xml
<plugin>
    <groupId>io.github.flowerjvm</groupId>
    <artifactId>flower-check-maven-plugin</artifactId>
    <version>${flower.version}</version>
    <executions>
        <execution>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

The `check` goal binds to `verify`. Add
`io.github.flowerjvm:flower-check-annotations:0.1.3` with `provided` scope only
when application source uses an official acknowledgement annotation.

## Gradle Kotlin DSL Setup

Configure plugin resolution in `settings.gradle.kts`:

```kotlin
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}
```

Then configure the host:

```kotlin
plugins {
    java
    id("io.github.flowerjvm.flower-check") version "0.1.3"
}

repositories {
    mavenCentral()
}

val flowerVersion = "0.1.3"

dependencies {
    implementation("io.github.flowerjvm:flower-core:$flowerVersion")
    testImplementation("io.github.flowerjvm:flower-testkit:$flowerVersion")
}
```

Use `compileOnly("io.github.flowerjvm:flower-check-annotations:0.1.3")` only
when the annotations are present. A Groovy DSL host should express the same
plugin ID, repositories, coordinates, versions, and scopes in Groovy syntax.

## Spring Boot Minimum

For Boot-managed Flower lifecycle, replace the direct `flower-core` dependency
with the starter; keep `flower-testkit` in test scope when its helpers are used.

```xml
<dependency>
    <groupId>io.github.flowerjvm</groupId>
    <artifactId>flower-spring-boot-starter</artifactId>
    <version>${flower.version}</version>
</dependency>
```

```yaml
flower:
  enabled: true
  auto-start: true
  persistence:
    type: none
  workers:
    - name: orders
      interval-ms: 100
```

The starter supplies default `Clock`, `EventBus`, `Engine`, lifecycle, and
Worker wiring and backs off for supported user-provided beans. It brings
`flower-core` and `flower-observability`; it does not configure
`flower-eventloop`. Preserve the host's Boot 3.x dependency management and
verify the selected Boot line rather than forcing the release build's own BOM.

## Persistence And Observability

Flower's JDBC modules provide stores, dialects, and schema resources. They do
not choose a JDBC driver, pool, `DataSource`, migration engine, database path,
or automatic schema creation. Apply the tick-flow schema, the event-flow
schema, or both according to the selected execution model. The packaged
dialects are PostgreSQL, MySQL, Oracle, H2, and SQLite; schema initialization
remains host-owned.

The observability module keeps SLF4J, Micrometer, and OpenTelemetry APIs
optional. Add only the binding/API used by the selected listener, preferably
through the host's existing dependency management.

## Verification

Run the host's real wrapper or installed build tool:

```powershell
mvn -B -ntp verify
```

```powershell
.\gradlew check
```

On POSIX:

```bash
./gradlew check
```

Confirm that tests ran and that Flower Check was actually configured and
executed. Inspect the dependency tree when selecting optional modules or
resolving version convergence. Never report an unexecuted command as passing.
