// UI locale never changes a card's synthesis language or the SDK's routing.
let saved;
try { saved = localStorage.getItem('flashcards-ui-language'); } catch { /* Storage can be disabled. */ }
let language = ['en', 'zh-CN'].includes(saved) ? saved : navigator.language.startsWith('zh') ? 'zh-CN' : 'en';
export const tr = (english, chinese) => language === 'zh-CN' ? chinese : english;
const translations = {
  '/ Flashcards': '/ 多语言卡片',
  'Interface language': '界面语言',
  'LOCAL APP · 127.0.0.1': '本地应用 · 127.0.0.1',
  'MULTILINGUAL AUDIO WORKSHOP': '多语言音频工作台',
  'Write it. Hear it. Keep it.': '写下短句，听见声音，保存音频。',
  'Turn your short phrases into a reusable set of MP3s. Each card keeps its own text and language.': '将短句变成可重复使用的 MP3。每张卡片分别设置文本和语言。',
  'Opening your local workspace…': '正在打开本地工作区…',
  '1. Connect your voice': '1. 连接授权音色',
  'The API key stays in the Node.js server environment.': 'API Key 只保存在 Node.js 服务端环境中。',
  'Load ready voices': '加载可用音色',
  'Authorized voice': '授权音色',
  'Load voices to choose': '请先加载音色',
  'Voice discovery and planning do not generate audio.': '查询音色和制定计划不会生成音频。',
  '2. Make a batch': '2. 编辑卡片批次',
  'Up to 200 cards · 500 normalized characters per card': '最多 200 张卡片 · 每张最多 500 个规范化字符',
  '+ Add card': '+ 添加卡片',
  'Batch title': '批次名称',
  'Supply the translation yourself and choose its matching language. Editing a saved batch requires a new plan.': '请自行提供翻译，并选择与文本匹配的语言。修改已保存批次需要另存新计划。',
  'Save plan & estimate': '保存计划并估算费用',
  '3. Review & generate': '3. 确认费用并生成',
  'Save a plan to see its cost and freeze the inputs before generating.': '先保存计划以查看费用，生成时使用已保存的文本与音色。',
  'I approve normal usage charges for this saved batch. Resume may submit its not-yet-started cards.': '我同意此已保存批次的正常使用费用。恢复时可能提交该批次尚未开始的卡片。',
  'Generate saved batch': '生成已保存批次',
  'Cards run one at a time. Keep the server running; closing this tab does not cancel the batch.': '卡片逐张处理。请保持本地服务运行；关闭此页面不会取消批次。',
  'Saved batches': '已保存批次',
  'Refresh': '刷新',
  'Open an original batch': '打开原批次',
  'Choose a saved batch': '选择已保存批次',
  'After a restart, open the same batch to recover its original jobs. A failed or expired job is never replaced automatically.': '重启后打开同一批次以恢复原任务。失败或过期任务不会自动创建替代任务。',
  'Your audio': '已生成音频',
  'No batch selected.': '尚未选择批次。',
  'Manifest': '结果清单',
  'Download all · ZIP': '下载全部 · ZIP',
  'Saved clips': '已保存音频',
  'Saved clips will appear here. Replay and download use your local files without generating again.': '已保存音频将显示在这里。播放和下载使用本地文件，不会再次生成。',
  'CastReader Voice API example · Keys and recovery checkpoints stay on this computer. No account recharge controls.': 'CastReader Voice API 示例 · 密钥和恢复检查点留在本机，不提供账户充值操作。',
};
// Capture only the initial static DOM. Dynamic content is rendered with tr().
const staticText = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const text = walker.currentNode, key = text.textContent.trim();
  if (Object.hasOwn(translations, key)) staticText.push({ text, key });
}
const attributes = [...document.querySelectorAll('[aria-label]')].map(element => ({ element, key: element.getAttribute('aria-label') }));
export function setLanguage(value = language) {
  language = value === 'zh-CN' ? 'zh-CN' : 'en';
  try { localStorage.setItem('flashcards-ui-language', language); } catch { /* Optional preference only. */ }
  document.documentElement.lang = language;
  document.title = tr('Flashcards · CastReader Voice API', '多语言卡片 · CastReader Voice API');
  document.getElementById('ui-language').value = language;
  for (const { text, key } of staticText) if (text.isConnected) text.textContent = tr(key, translations[key]);
  for (const { element, key } of attributes) if (translations[key]) element.setAttribute('aria-label', tr(key, translations[key]));
}
export function errorMessage(code, fallback) {
  const errors = {
    missing_key: '请在终端设置 CASTREADER_API_KEY 后重启应用。',
    sdk_unavailable: '请在解压后的示例目录运行 npm install 后重启应用。',
    invalid_api_key: '请检查服务端环境变量 CASTREADER_API_KEY。',
    expired_api_key: '请在服务端环境中更新已过期的密钥。',
    insufficient_scope: '密钥需要 speech:generate、voices:read 和 usage:read 权限。',
    insufficient_balance: '当前余额不足以处理此输入。应用没有发起充值。',
    invalid_voice: '请选择服务端返回的已准备好且获授权的音色。',
    voice_not_found: '此密钥无法使用所选音色。',
    voice_language_unverified: '所选音色尚未启用某个输入语言。',
    text_language_mismatch: '请检查每张卡片的语言是否与文本一致。',
    unsupported_language: '当前处理区域不支持某个输入语言。',
    model_limit: '当前处理区域不支持某个输入语言或文本长度。',
    invalid_input: '请使用 1–200 张卡片，ID 需唯一且为小写，每张文本为 1–500 个规范化字符。',
    invalid_title: '批次名称应为 1–80 个字符。',
    estimate_unavailable: '某个输入未通过余额估算检查。没有提交生成请求。',
    invalid_estimate: '后端估算结果无效或字符数不匹配，计划已停止。',
    rate_limit_exceeded: 'API 请求频率受限，请稍候再恢复同一批次。',
    admission_paused: '服务暂停接受新任务，请保留批次稍后恢复。',
    batch_running: '已有批次正在处理，请等待后再开始其他批次。',
    batch_locked: '此批次存在 .running 锁。确认旧进程结束后才可手动删除对应锁文件。',
    checkpoint_missing: '已开始的批次丢失了检查点，请恢复原文件后再继续。',
    csrf_denied: '请刷新本地页面以建立新会话。',
    audio_missing: '音频尚未保存或本地文件丢失，请恢复原批次以下载原结果。',
    checksum_mismatch: '本地文件校验失败，请恢复原批次以下载原结果。',
    unsafe_directory: '批次包含符号链接或目录不安全，请恢复原始普通文件后继续。',
    archive_limit: '批次超过 128 MiB ZIP 上限，请分别下载音频和结果清单。',
    operation_stopped: '操作已停止。请保留批次并恢复原任务；若仍无法完成，请检查 API 控制台。',
  };
  return tr(fallback, errors[code] || fallback);
}
setLanguage();
