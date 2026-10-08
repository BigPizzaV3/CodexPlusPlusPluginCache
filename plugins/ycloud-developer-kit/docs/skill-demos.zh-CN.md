# Skill 演示手册

安装插件后，在一个本地演示项目的新对话中复制对应提示词。以下均为演示设计和预期结果，不是已执行的测试报告。除安装检查外，示例标识是合成业务输入，不是可以直接发送的 API 请求；由 Skill 根据随包契约生成完整 fixture。

需要生成代码的示例只授权在当前本地演示项目中写入文件。使用 mock transport，不访问真实密钥、环境文件、客户数据或 Provider API。验收时检查实际生成的代码和测试结果。

## 订单通知集成方案 — ycloud-integration-architect

[Skill 说明](../skills/ycloud-integration-architect/SKILL.md)

```text
使用 $ycloud-integration-architect。为一个 TypeScript 订单服务设计 WhatsApp 发货通知集成：订单 demo_order_001，模板 demo_order_update，语言 en_US。先给出模块边界、模板/消息/Webhook 的交接和 mock 测试计划，不修改项目。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：给出方案、前置条件与测试清单；区分模板审批、请求受理和最终送达。

## 服务端鉴权 — ycloud-api-authentication

[Skill 说明](../skills/ycloud-api-authentication/SKILL.md)

```text
使用 $ycloud-api-authentication。在本地 TypeScript 示例中实现 YCloud X-API-Key 请求注入与日志脱敏，使用内存中的 SYNTHETIC_DEMO_KEY 和 mock transport；补充缺失配置测试，不读取环境文件。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：密钥仅在服务端适配器中使用；请求头测试通过，日志不包含演示密钥。

## 模板消息适配器 — ycloud-whatsapp-messages

[Skill 说明](../skills/ycloud-whatsapp-messages/SKILL.md)

```text
使用 $ycloud-whatsapp-messages。为订单 demo_order_001 实现模板 demo_order_update 的本地发送适配器，语言 en_US，模板变量为 Demo Customer。号码使用项目 mock fixture，按包内契约构造请求；模拟受理、参数错误和超时。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：生成契约匹配的请求和 mock 测试；受理不被当作送达，超时不会盲目重复发送。

## 媒体上传 — ycloud-whatsapp-media

[Skill 说明](../skills/ycloud-whatsapp-media/SKILL.md)

```text
使用 $ycloud-whatsapp-media。设计本地 PNG 媒体 fixture 的上传与返回 ID 映射，媒体内容使用合成测试图片，transport 使用 mock。按包内契约展示 multipart 构造及失败处理。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：展示 multipart 字段和媒体响应映射；没有真实上传，也不把本地文件路径直接作为远端媒体 ID。

## 轮播模板 — ycloud-whatsapp-templates

[Skill 说明](../skills/ycloud-whatsapp-templates/SKILL.md)

```text
使用 $ycloud-whatsapp-templates。为 demo_carousel 模板生成本地轮播示例，语言 en_US，两张图片卡片，各一个 URL 按钮。使用合成内容和 example.com 媒体地址；对比模板创建结构与发送时仅覆盖一张卡片的结构，补充 mock 验证。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：区分创建与发送结构，模板名称允许下划线；两张卡片定义及单张覆盖均有示例。

## Webhook 接收 — ycloud-webhook-endpoints

[Skill 说明](../skills/ycloud-webhook-endpoints/SKILL.md)

```text
使用 $ycloud-webhook-endpoints。为本地 TypeScript 服务设计 Webhook 接收器，使用合成事件 demo_event_001 和内存演示签名密钥；按包内签名契约生成有效、无效和重复事件的 mock 测试。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：验证原始请求体签名、拒绝无效签名并处理重复事件；不创建真实端点。

## 账户列表 — ycloud-whatsapp-business-accounts

[Skill 说明](../skills/ycloud-whatsapp-business-accounts/SKILL.md)

```text
使用 $ycloud-whatsapp-business-accounts。实现只使用 mock transport 的业务账户列表与详情映射，使用 demo_waba_001 作为合成标识；依据包内契约构造响应，覆盖空列表和不存在的情况。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：展示列表和详情的类型映射及错误测试；不声称查询了真实账户。

## 号码资料 — ycloud-whatsapp-phone-numbers

[Skill 说明](../skills/ycloud-whatsapp-phone-numbers/SKILL.md)

```text
使用 $ycloud-whatsapp-phone-numbers。设计业务号码列表和资料查询适配器，使用合成 ID demo_phone_001 与 mock transport；按契约构造 fixture，覆盖空列表和权限失败。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：给出只读映射和错误处理，不执行注册或修改真实号码。

## 群组异步结果 — ycloud-whatsapp-groups

[Skill 说明](../skills/ycloud-whatsapp-groups/SKILL.md)

```text
使用 $ycloud-whatsapp-groups。以合成群组 demo_group_001 为例，设计群组请求受理后通过事件更新状态的本地流程；transport 与事件均 mock，包含重复和乱序回调。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：区分请求受理与最终结果，说明关联标识及重复事件处理，不创建真实群组。

## Flow 草稿 — ycloud-whatsapp-flows

[Skill 说明](../skills/ycloud-whatsapp-flows/SKILL.md)

```text
使用 $ycloud-whatsapp-flows。规划合成预约 Flow demo_booking 的草稿创建、内容更新和验证流程；按包内契约生成 mock 请求及验证失败示例，不发布。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：展示草稿与发布的阶段区别、验证错误处理和本地测试，未发布真实 Flow。

## 入站已读 — ycloud-whatsapp-inbound-messages

[Skill 说明](../skills/ycloud-whatsapp-inbound-messages/SKILL.md)

```text
使用 $ycloud-whatsapp-inbound-messages。对合成入站消息 demo_inbound_001 实现已读和 typing 指示的本地适配器，mock transport，覆盖消息不存在和重复操作。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：仅覆盖契约中的入站确认能力；不把 typing 指示等同于发送业务回复。

## 余额映射 — ycloud-balance

[Skill 说明](../skills/ycloud-balance/SKILL.md)

```text
使用 $ycloud-balance。使用按包内契约构造的合成余额响应（金额 123.45、币种 USD），实现 mock 查询与显示映射，并覆盖金额为零和请求失败。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：保留币种与金额，明确数据为模拟；不根据该数值断言生产环境可用。

## 联系人同步 — ycloud-contacts

[Skill 说明](../skills/ycloud-contacts/SKILL.md)

```text
使用 $ycloud-contacts。设计合成联系人 Demo Customer 的本地联系人同步流程，外部业务标识 demo_customer_001；按包内契约选择字段，mock transport，覆盖已存在与字段校验失败。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：给出创建/更新决策、字段映射与测试；不读取真实通讯录。

## CONTACT 事件 — ycloud-custom-events

[Skill 说明](../skills/ycloud-custom-events/SKILL.md)

```text
使用 $ycloud-custom-events。设计 CONTACT 类型的合成事件 demo_order_paid 及属性定义，再展示联系人事件上报的 mock 示例，按包内契约区分定义操作与事件摄取。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：展示事件定义、属性和摄取的不同职责，不发出真实事件。

## 发送前退订检查 — ycloud-unsubscribers

[Skill 说明](../skills/ycloud-unsubscribers/SKILL.md)

```text
使用 $ycloud-unsubscribers。实现 mock 退订状态查询与发送前判断，使用合成客户标识 demo_customer_001；按包内契约生成已退订、未退订和查询失败 fixture。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：分别展示三种状态，查询失败处理明确标为项目策略，不删除真实退订记录。

## 呼叫状态处理 — ycloud-whatsapp-calling

[Skill 说明](../skills/ycloud-whatsapp-calling/SKILL.md)

```text
使用 $ycloud-whatsapp-calling。以合成呼叫 demo_call_001 为例，设计 connect、pre-accept、accept、reject、terminate 的本地适配器与状态判断，所有响应和事件均 mock。只使用合成数据与本地 mock，不调用真实 API，不读取凭据或环境文件。
```

验收：按包内契约说明操作前置条件及失败情况；不发起、接听或终止真实电话。

## 安装发现检查 — ycloud-developer-kit-smoke-test

[Skill 说明](../skills/ycloud-developer-kit-smoke-test/SKILL.md)

```text
使用 $ycloud-developer-kit-smoke-test。检查本地 YCloud Developer Kit 插件是否已安装并可发现。
```

验收：仅返回：YCloud Developer Kit is ready. No external API was called.
