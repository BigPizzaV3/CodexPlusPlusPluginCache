# 火山 ASR 零基础配置向导

> 适用对象：第一次使用火山引擎、需要让本 Skill 自动转写口播视频的安装者。  
> 预计用时：账号已完成实名认证时约 15～30 分钟。  
> 控制台名称和按钮位置可能更新；找不到时按本文中的产品名称搜索，不要照旧截图盲点。

## Agent 首次配置带领方式（强制）

本节规定 Agent **怎么教用户**。后面的章节是 Agent 的完整技术参考，不得把后文的字段
清单一次性复制给零基础用户。

### 发现未配置时，先说人话

首次回复控制在用户一眼能读完的长度。使用下面的意思和顺序，可根据上下文自然改写：

> 本地剪辑工具已经准备好了。下一步需要先把视频里的声音转成“每个词都带时间点”的
> 文字，这样才能准确剪掉口误，不会切断字音。
>
> 第一次使用需要在火山引擎开通两个服务：豆包语音负责听写；TOS 只临时放转写用的
> 音频，完成后脚本会删除。按每天一条 7 分钟口播估算，通常每月只是几元钱，实际以
> 你的控制台为准。
>
> 我会一次带你做一步，不需要你懂 API，也不要把任何密钥发给我。第一步先确认：
> 你有没有火山引擎账号，并且完成实名认证？如果没有，请打开
> https://www.volcengine.com/ 注册并实名；完成后只回复“已实名”，我再带你开通语音识别。

如果用户明确已经有账号并实名，直接进入下一阶段，不重复讲注册。

### 必须按阶段推进

| 阶段 | Agent本轮只让用户完成的事 | 用户完成标志 |
|---|---|---|
| 1 | 注册或登录火山引擎，完成实名认证 | 回复“已实名” |
| 2 | 在豆包语音控制台开通录音文件识别模型 2.0 | 回复“已开通”或发控制台截图 |
| 3 | 根据新版/旧版界面取得语音 API Key，或 App ID＋Access Token | 回复“语音凭证已保存” |
| 4 | 在 TOS 创建一个私有桶 | 回复“桶已创建”或发桶概览截图 |
| 5 | 记录 Bucket、Region、外网 Endpoint，并创建 TOS AK/SK | 回复“TOS 信息已保存” |
| 6 | Agent生成空白配置；用户只在本机填写并保存 | 回复“配置已保存” |
| 7 | Agent运行 `doctor.py` 和短素材冒烟测试 | Agent报告是否通过 |

不得跳过用户尚未完成的阶段，也不得一次把后面所有阶段都堆给用户。用户主动要求“一次
把全部步骤发来”时才可提供完整清单。

### 每一步都要包含四件事

1. **去哪里**：给出产品名称或官方入口；
2. **做什么**：最多 3～5 个点击动作；
3. **看到什么算成功**：说清页面或状态名称；
4. **怎么继续**：让用户回复一个短句，或发不含密钥的截图。

用户说“找不到”“页面不一样”时，不得猜按钮。请用户截取整个控制台页面，提醒遮住或
避开任何完整密钥，再根据截图指出下一步。

### 后续阶段推荐话术

#### 阶段 2：开通录音识别

> 好，接下来只做“开通语音识别”这一件事：
>
> 1. 登录火山控制台，在顶部搜索“豆包语音”；
> 2. 进入后找“开通管理”或“服务管理”；
> 3. 找到“大模型录音文件识别/录音文件识别”，选择模型 2.0 并开通；
> 4. 页面显示已开通或可用就算完成。
>
> 如果你的页面名称不一样，发一张不含密钥的完整页面截图给我，我帮你找。完成后回复
> “录音识别已开通”。

#### 阶段 3：取得语音凭证

> 现在只处理语音识别的调用凭证。请看豆包语音控制台里有没有“API Key 管理”：
>
> - 如果有：进去为当前项目创建一个 API Key，在你自己的电脑上安全保存；
> - 如果没有、但看到“应用列表”：打开刚才的应用，保存其中的 App ID 和 Access Token。
>
> 不要把这些内容发给我。保存好以后只回复“语音凭证已保存”。如果你不确定自己是哪种
> 界面，可以发一张遮住密钥的截图。

#### 阶段 4：创建临时音频桶

> 语音服务准备好了。现在创建一个只用来临时中转音频的存储桶：
>
> 1. 在火山控制台搜索“对象存储 TOS”并开通；
> 2. 进入“桶列表”，点击“创建桶”；
> 3. 桶名自定义且保持私有，地域选离你较近的位置；
> 4. 创建后进入这个桶的“概览”页面。
>
> 完成后回复“桶已创建”。如果希望我帮你核对页面，可以发桶概览截图；截图不要包含
> Access Key 或 Secret Key。

#### 阶段 5：保存 TOS 信息

> 请在刚才的桶概览里记下 Bucket、Region 和外网 Endpoint。然后在账号菜单的“API 访问
> 密钥/密钥管理”中创建一组 Access Key ID 和 Secret Access Key，也只保存在你自己的
> 电脑上。
>
> 这组是 TOS 使用的密钥，和刚才豆包语音的凭证不是一回事。全部保存好后只回复
> “TOS 信息已保存”。

#### 阶段 6：最后才填写配置

此时才运行 `init_config.py`，再告诉用户：

> 我已经生成空白配置文件。请在本机打开我给出的 `config.json` 链接，按照文件中的中文
> 提示填写刚才保存的信息。不要把文件内容或密钥发到聊天里。保存后只回复
> “配置已保存”，我会自动体检，不会打印你的密钥。

只有用户需要字段对应帮助时，才展示相关的局部映射；不要再次粘贴整个 JSON。

### 禁止出现的首次阻塞回复

- 只说“请填写 api_key、app_id、access_token、AK/SK、Endpoint、Region”；
- 一上来展示完整 JSON；
- 在同一条回复里同时讲注册、开服务、建桶、建密钥、填配置、体检和转写；
- 用 `resource_id`、词级时间戳结构、编码器、磁盘、可选组件等信息淹没当前动作；
- 把“详细教程文件路径”当成已经教会用户；
- 要求用户把密钥或完整配置粘贴到聊天。

## 目录

1. [Agent 首次配置带领方式](#agent-首次配置带领方式强制)
2. [先理解：为什么要开通两项服务](#一先理解为什么要开通两项服务)
3. [开始前准备](#二开始前准备)
4. [开通豆包语音录音文件识别](#三开通豆包语音录音文件识别)
5. [取得 ASR 鉴权信息](#四取得-asr-鉴权信息)
6. [开通 TOS 并创建私有桶](#五开通-tos-并创建私有桶)
7. [取得 TOS 的 AK/SK](#六取得-tos-的-aksk)
8. [填写本地配置](#七填写本地配置)
9. [运行体检和第一次转写](#八运行体检和第一次转写)
10. [常见错误](#九常见错误)
11. [安全、费用和 Agent 边界](#十安全费用和-agent-边界)

## 一、先理解：为什么要开通两项服务

本 Skill 使用：

1. **豆包语音大模型录音文件识别 2.0**：把口播音频转成文字和词级时间戳；
2. **火山对象存储 TOS**：临时存放音频，让识别服务能够通过短时有效的下载地址读取它。

流程如下：

```text
本地视频
  ↓ 抽取音频
用户自己的 TOS 私有桶
  ↓ 生成约一小时有效的预签名下载地址
豆包语音录音文件识别 2.0
  ↓ 返回逐句文字、词级时间戳
脚本删除 TOS 中的临时音频
```

桶不需要设置成公开读。脚本会为单个临时对象生成预签名地址，并在转写结束后尝试删除
对象。

### 最后需要拿到哪些信息

先不要急着填配置。完成控制台操作后，需要得到下面两组信息。

**豆包语音 ASR：二选一**

- 新版方式：1 个豆包语音产品 API Key；
- 旧版方式：App ID 和 Access Token。

**TOS：共 5 项**

- Access Key ID；
- Secret Access Key；
- Bucket 名称；
- Region；
- 外网 Endpoint。

### 三种凭证不要混用

| 名称 | 用途 | 填入位置 |
|---|---|---|
| 豆包语音产品 API Key | 调用录音文件识别 | `volc_asr.api_key` |
| 豆包语音 App ID＋Access Token | 旧版录音识别鉴权 | `volc_asr.app_id`、`volc_asr.access_token` |
| 火山 Access Key ID＋Secret Access Key | 访问 TOS 桶 | `volc_tos.access_key`、`volc_tos.secret_key` |

特别注意：

- TOS 的 Access Key ID 不是豆包语音 API Key；
- 火山控制台通用的“API 访问密钥/AK-SK”也不是豆包语音产品 API Key；
- 不要去 LAS 等其他产品页面申请同名 Key；
- ASR 新旧两套鉴权只选一套，不要拼接不同应用或不同账号的值。

## 二、开始前准备

1. 打开[火山引擎官网](https://www.volcengine.com/)并注册或登录。
2. 按控制台提示完成实名认证。
3. 确认账号可以开通付费云服务。
4. 阅读当前价格、免费额度、并发和欠费策略。本文不写死价格，以控制台当天显示为准。

个人试用可以由本人完成以下步骤。公司或多人协作环境，建议让管理员创建专用 IAM
用户，并只授予目标 TOS 桶所需的权限。

## 三、开通豆包语音录音文件识别

1. 登录火山控制台。
2. 在顶部搜索框搜索“豆包语音”，进入豆包语音控制台。
3. 找到“开通管理”“服务管理”或类似入口。
4. 找到“录音文件识别”“大模型录音文件识别”或“语音识别大模型”。
5. 开通**录音文件识别模型 2.0**，并确认服务状态为可用。
6. 如果控制台要求创建项目或应用，先创建一个专用于该剪辑 Skill 的项目/应用。

本 Skill 当前固定使用：

```text
endpoint    = https://openspeech.bytedance.com
resource_id = volc.seedasr.auc
```

不要填模型 1.0 的资源 ID：

```text
volc.bigasr.auc
```

官方产品文档说明，大模型录音文件识别可以返回分句结果，并支持词级时间戳；词级时间戳
是本 Skill 精确剪切口播的必要数据。

## 四、取得 ASR 鉴权信息

火山语音控制台可能向不同账号展示新版或旧版界面。**以豆包语音产品控制台实际展示的
鉴权方式为准。**

### 情况 A：看到“API Key 管理”

1. 在豆包语音控制台内进入“API Key 管理”。
2. 为当前项目创建一个 API Key，或复制已为该项目创建的 Key。
3. 将它保存到本地密码管理工具，稍后填入：

   ```text
   volc_asr.api_key
   ```

4. `app_id` 和 `access_token` 留空。

这里必须是**豆包语音产品控制台内**用于语音接口调用的 API Key，不是 TOS AK，也不是
其他火山产品的 API Key。

### 情况 B：看到“应用列表/应用详情”

旧版控制台通常按应用提供鉴权：

1. 进入豆包语音控制台的“应用列表”。
2. 创建或打开本次使用的应用。
3. 在应用详情或服务信息中找到：

   - App ID；
   - Access Token。

4. 稍后分别填入：

   ```text
   volc_asr.app_id
   volc_asr.access_token
   ```

5. `api_key` 留空。

### 不知道该选哪一种时

- 控制台有豆包语音“API Key 管理”就优先用情况 A；
- 只有应用详情中的 App ID 和 Access Token，就用情况 B；
- 不要为了凑 `api_key` 字段去火山 IAM 页面创建通用 API Key；
- 如果两套入口都找不到，先确认已开通录音文件识别 2.0，再联系火山技术支持确认该账号
  当前的数据面鉴权方式。

## 五、开通 TOS 并创建私有桶

1. 在火山控制台搜索“对象存储 TOS”。
2. 首次使用时按提示开通服务。
3. 进入“桶列表”，点击“创建桶”。
4. 输入全局唯一的桶名，例如：

   ```text
   yourname-koubo-asr
   ```

5. 选择离使用者较近的地域。地域创建后通常不能修改。
6. 访问权限保持**私有**，不要开启公共读。
7. 其余选项没有公司特殊要求时可保持默认。
8. 创建后打开该桶的“概览”页面，记录：

   - Bucket 名称；
   - Region；
   - 外网 Endpoint。

格式可能类似：

```text
bucket   = yourname-koubo-asr
region   = cn-beijing
endpoint = tos-cn-beijing.volces.com
```

这只是格式示例。必须复制自己桶概览页显示的值，不能照抄北京地域。

## 六、取得 TOS 的 AK/SK

TOS 需要火山账号或 IAM 用户的访问密钥：

- Access Key ID，常简称 AK；
- Secret Access Key，常简称 SK。

### 个人首次测试

可以进入控制台右上角账号菜单中的“API 访问密钥/密钥管理”，按提示创建 Access Key。
Secret Access Key 往往只在创建时完整显示一次，应立即保存在密码管理工具中。

### 公司或长期使用

建议让管理员：

1. 新建一个专用于本 Skill 的 IAM 用户；
2. 只允许它访问刚创建的 TOS 桶；
3. 至少提供本流程需要的上传、读取/签名、列举或确认桶、删除对象权限；
4. 为该 IAM 用户创建独立 AK/SK；
5. 不授予无关云服务或其他桶的权限。

这组 AK/SK 只填 `volc_tos`，不要填到 `volc_asr`。

## 七、填写本地配置

### 1. 让脚本生成空白配置

不要复制其他用户的配置，也不要在上级目录或历史项目中寻找密钥。在本次任务目录生成自己的模板。

macOS/Linux：

```bash
.venv/bin/python "$SKILL_DIR/scripts/init_config.py" --out ./config.json
```

Windows PowerShell（把路径改成自己的安装位置）：

```powershell
$SkillDir = "C:\Users\你的用户名\.codex\skills\rough-cut"
& "$SkillDir\.venv\Scripts\python.exe" `
  "$SkillDir\scripts\init_config.py" `
  --out ".\config.json"
```

脚本不会覆盖已有配置。

### 2. 新版 API Key 配置示例

用本地文本编辑器打开 `config.json`：

```json
{
  "volc_asr": {
    "app_id": "",
    "access_token": "",
    "api_key": "填自己的豆包语音产品 API Key",
    "resource_id": "volc.seedasr.auc",
    "endpoint": "https://openspeech.bytedance.com",
    "enable_words": true,
    "enable_speaker": true
  },
  "volc_tos": {
    "access_key": "填自己的 TOS Access Key ID",
    "secret_key": "填自己的 TOS Secret Access Key",
    "endpoint": "填自己桶概览页的外网 Endpoint",
    "region": "填自己桶所在的 Region",
    "bucket": "填自己的 Bucket 名称"
  }
}
```

### 3. 旧版 App ID＋Access Token 配置示例

```json
{
  "volc_asr": {
    "app_id": "填自己的 App ID",
    "access_token": "填自己的 Access Token",
    "api_key": "",
    "resource_id": "volc.seedasr.auc",
    "endpoint": "https://openspeech.bytedance.com",
    "enable_words": true,
    "enable_speaker": true
  },
  "volc_tos": {
    "access_key": "填自己的 TOS Access Key ID",
    "secret_key": "填自己的 TOS Secret Access Key",
    "endpoint": "填自己桶概览页的外网 Endpoint",
    "region": "填自己桶所在的 Region",
    "bucket": "填自己的 Bucket 名称"
  }
}
```

除非以后明确切换模型并同步修改脚本，否则不要改：

```text
resource_id = volc.seedasr.auc
```

保存后不要把 `config.json` 发到聊天、邮件、群聊或 Git 仓库。

## 八、运行体检和第一次转写

### 1. 本地体检

macOS/Linux：

```bash
.venv/bin/python "$SKILL_DIR/scripts/doctor.py" --config ./config.json
```

Windows PowerShell：

```powershell
& "$SkillDir\.venv\Scripts\python.exe" `
  "$SkillDir\scripts\doctor.py" `
  --config ".\config.json"
```

体检会检查：

- Python、ffmpeg 和依赖是否就绪；
- ASR 是否选择了一套完整鉴权；
- TOS 五个字段是否齐全；
- 是否仍含空白或示例占位值。

体检不打印密钥。看到：

```text
环境就绪
```

才进入下一步。这个结果只表示本地配置完整，不代表云端服务和权限一定正确。

### 2. 准备短测试素材

使用 5～15 秒、没有隐私敏感内容的中文口播视频。不要第一次就上传正式长素材。

macOS/Linux：

```bash
mkdir -p workspace/asr-smoke-test/output

.venv/bin/python "$SKILL_DIR/scripts/probe.py" \
  "/短视频的绝对路径/test.mp4" \
  --out workspace/asr-smoke-test/output/
```

应生成：

```text
workspace/asr-smoke-test/output/audio.wav
workspace/asr-smoke-test/output/meta.json
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory `
  -Force ".\workspace\asr-smoke-test\output" | Out-Null

& "$SkillDir\.venv\Scripts\python.exe" `
  "$SkillDir\scripts\probe.py" `
  "C:\你的短视频绝对路径\test.mp4" `
  --out ".\workspace\asr-smoke-test\output"
```

### 3. 运行上传、转写和清理

macOS/Linux：

```bash
.venv/bin/python "$SKILL_DIR/scripts/transcribe_pipeline.py" \
  workspace/asr-smoke-test/output/audio.wav \
  --out workspace/asr-smoke-test/output/ \
  --config ./config.json
```

Windows PowerShell：

```powershell
& "$SkillDir\.venv\Scripts\python.exe" `
  "$SkillDir\scripts\transcribe_pipeline.py" `
  ".\workspace\asr-smoke-test\output\audio.wav" `
  --out ".\workspace\asr-smoke-test\output" `
  --config ".\config.json"
```

编排脚本会：

1. 把音频上传到用户自己的私有 TOS 桶；
2. 生成但不打印临时预签名 URL；
3. 调用录音文件识别 2.0；
4. 写出 `transcript.json`；
5. 无论成功或失败，都尝试删除 TOS 临时对象。

### 4. 判断是否真正配置成功

打开：

```text
workspace/asr-smoke-test/output/transcript.json
```

确认：

1. 存在 `full_text`，中文内容基本正确；
2. `utterances` 不是空数组；
3. 每句有合理的 `start` 和 `end`；
4. 每句中的 `words` 不是空数组；
5. 每个词有开始和结束时间；
6. 最后一个时间戳与音频时长大体一致。

只有整段文字而没有 `words` 词级时间戳，不能进入本 Skill 的精确口播剪辑流程。

## 九、常见错误

| 现象 | 最常见原因 | 处理 |
|---|---|---|
| `未找到用户自己的火山配置` | 没传 `--config`，当前目录也没有配置 | 使用配置文件绝对路径，或设置 `ROUGH_CUT_CONFIG` |
| `仍为占位值` | 生成模板后没有填完整 | 按体检提示补齐，不要把模板示例当真实值 |
| ASR 返回 401/403 | ASR Key 错、服务未开通、项目不匹配 | 回豆包语音控制台确认录音识别 2.0、项目和鉴权 |
| Resource ID 错误 | 开通了模型 1.0 或填错资源 ID | 使用 `volc.seedasr.auc` 并确认模型 2.0 已开通 |
| TOS `AccessDenied` | AK/SK 错或 IAM 权限不足 | 确认是 TOS AK/SK，并给专用用户目标桶必要权限 |
| endpoint/region 错误 | 照抄示例地域，或两者不匹配 | 从同一个桶的概览页重新复制 Bucket、Region、Endpoint |
| ASR 无法下载音频 | 预签名 URL 过期、对象已删或外网不可达 | 重新运行完整 pipeline，避免手动复用旧 URL |
| 有文字但没有 `words` | 模型/接口不匹配，或返回结构已变化 | 停止剪辑，核对模型 2.0 与官方接口文档 |
| 桶中残留测试音频 | 异常退出导致自动清理失败 | 在控制台删除，或按脚本记录的对象 key 清理 |

如需向火山技术支持反馈，可提供：

- `X-Api-Status-Code`；
- `X-Api-Message`；
- `X-Tt-Logid`（如果返回）。

不要提供 API Key、Access Token、AK/SK、完整配置文件或仍在有效期内的预签名 URL。

## 十、安全、费用和 Agent 边界

### 用户必须知道

- 识别、存储和外网流量费用由安装者自己的火山账号承担；
- 正式使用前查看控制台当天的价格、免费额度、并发和欠费策略；
- `config.json` 必须加入项目 `.gitignore`，不得打进 Skill 安装包；
- 长效密钥应保存在密码管理工具中，并定期轮换；
- 怀疑泄露时立即禁用旧密钥、创建新密钥并更新本地配置；
- 预签名 URL 在有效期内也属于敏感信息；
- 正常转写后应自动删除临时音频，失败后也要检查桶内是否残留。

### Agent 可以做

- 打开本教程并按步骤引导用户；
- 打开官方控制台页面，告诉用户当前要找的字段；
- 运行 `init_config.py` 生成空白模板；
- 等用户在本机填好并保存后运行 `doctor.py`；
- 使用不含隐私的短素材做冒烟测试；
- 根据不含密钥的错误码和 Log ID 排查问题。

### Agent 不可以做

- 提供、复用或搜索开发者及其他用户的账号和密钥；
- 要求用户把密钥粘贴进聊天；
- 在终端、报告或工具输出里打印配置全文；
- 代替用户把私人密钥写进 Skill 或公开仓库；
- 把配置成功理解为密钥可以分享；
- 忘记清理 TOS 中的临时音频。

用户只需要告诉 Agent：

```text
“我已经在本机填好 config.json，可以开始体检。”
```

如果失败，只发送去除敏感信息后的错误码和 Log ID，不发送配置内容。

## 官方参考

- [大模型录音文件识别产品文档](https://www.volcengine.com/docs/6561/1354871?lang=zh)
- [豆包语音旧版控制台快速入门](https://www.volcengine.com/docs/6561/163043?lang=zh)
- [火山引擎 API 访问密钥管理](https://www.volcengine.com/docs/6291/65568)
- [TOS 控制台快速入门](https://www.volcengine.com/docs/6349/74830)
- [TOS 基本概念：Bucket、Region、Endpoint、AK/SK](https://www.volcengine.com/docs/6349/74836?lang=zh)
- [TOS 权限配置参考](https://www.volcengine.com/docs/6349/1111478?lang=zh)
