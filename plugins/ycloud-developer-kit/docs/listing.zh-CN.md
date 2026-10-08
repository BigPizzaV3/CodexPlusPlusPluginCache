# 插件上架资料

这些资料随安装 ZIP 分发。官网链接于 2026-09-10 核实。

| 页面字段 | 内容 | ZIP 中的位置 |
| --- | --- | --- |
| Name | YCloud Developer Kit | interface.displayName |
| Short description | Build WhatsApp Business integrations | interface.shortDescription（36 字符） |
| Description | 见 `.codex-plugin/plugin.json` 的完整介绍 | interface.longDescription |
| Category | Productivity | interface.category |
| Developer name | YCloud Developers | interface.developerName |
| Website URL | https://www.ycloud.com/ | interface.websiteURL |
| Customer support URL | https://www.ycloud.com/customer-support | 本文件；提交页面手工填写 |
| Privacy policy URL | https://www.ycloud.com/privacy-policy | interface.privacyPolicyURL |
| Terms of Service URL | https://www.ycloud.com/terms-service | interface.termsOfServiceURL |
| Version | 以 `.codex-plugin/plugin.json` 的 version 为准 | version |
| Package name | ycloud-developer-kit | name |
| Capabilities | Interactive, Code Generation, API Integration | interface.capabilities |

当前使用的 manifest 规范未定义 Customer support URL 字段，因此未添加不受支持的字段。上传 ZIP 后检查页面是否正确导入三个 URL，并将上述客户支持链接填入对应栏。

## 完整介绍

以下英文与 `interface.longDescription` 保持一致，可直接用于插件详情页：

Build WhatsApp Business API integrations in your existing app with YCloud. Turn requirements such as order notifications, appointment reminders, customer support, and lead capture into an integration plan, server-side code, and local tests. Get help with template and media messages, incoming messages and delivery-status webhooks, contacts and unsubscribe preferences, WhatsApp Flows, business accounts, phone numbers, groups, and calling. The skills guide your coding agent through authentication, request and response handling, webhook verification, and error handling, using YCloud API contracts and official documentation. Start from a new workflow or review an existing integration, then check its behavior with mocks and local sandbox tests for supported scenarios. Develop and validate locally; your application connects to YCloud at runtime using credentials managed by your team.

中文说明：在现有应用中集成 YCloud WhatsApp Business API，把订单通知、预约提醒、客服和线索收集等需求转化为接入方案、服务端代码和本地测试。支持消息与模板、媒体、入站消息与送达状态回调、联系人与退订偏好、Flows、商业账户、号码、群组和通话等集成场景。开发助手依据 API 契约与官方文档，协助处理鉴权、请求与响应、Webhook 验签及错误处理，也可检查已有集成。先在本地用模拟测试和已支持场景的 Sandbox 验证，再由团队配置凭据并运行实际应用。

[中文使用指南](product-guide.zh-CN.md) · [17 个 Skill 演示](skill-demos.zh-CN.md)

演示文档包含可复制提示词、合成输入和预期结果；它不是实际执行记录或录屏。需要上架录屏时，可按演示步骤运行并录制实际结果。

## 可直接填写的首页 Prompts

上传 ZIP 时由 `interface.defaultPrompt` 提供；如页面保留旧值，可将下列三条分别粘贴到 Prompt 1–3。页面自动添加插件名称，文案无需包含 Skill 标识。

```text
Build WhatsApp order notifications with templates and delivery tracking.
```

```text
Add WhatsApp inbound-message and status webhooks with local tests.
```

```text
Review my WhatsApp Business integration and suggest fixes.
```
