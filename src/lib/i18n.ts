export type Locale = "en" | "zh";

const en = {
  "nav.home": "Dashboard",
  "nav.today": "For You",
  "nav.history": "History",
  "nav.user": "User",
  "nav.memory": "Memory",
  "nav.collapse": "Collapse sidebar",
  "nav.expand": "Expand sidebar",
  "nav.library": "Library",
  "nav.libraryHint": "what you capture",
  "nav.libraryEmpty": "No sources yet — paste a link above to start",
  "nav.notebook": "Notebook",
  "nav.notebookHint": "what you write with your agent",
  "nav.notebookEmpty": "Nothing here yet — ask the Agent to draft a brief from your sources",
  "view.welcome": "Welcome to Second Brain",
  "view.activity": "Daily Activity",
  "header.settings": "Settings",
  "header.checking": "Checking",
  "header.connected": "connected",
  "header.disconnected": "not connected",
  "menu.delete": "Delete",
  "menu.rename": "Rename",
  "settings.title": "Settings",
  "settings.appearance": "Appearance",
  "settings.feed": "Feed",
  "settings.agent": "Agent",
  "settings.language": "Language",
  "settings.theme": "Theme",
  "settings.font": "Font",
  "settings.light": "Light",
  "settings.dark": "Dark",
  "settings.system": "System",
  "capture.chooseFile": "Choose file",
  "capture.drop": "Drop file here...",
  "capture.note": "Add a note (optional)...",
  "capture.idle": "Paste a link, text, or choose a file...",
  "capture.unsupported": "Images, PDFs, and EPUBs can be added",
  "capture.processing": "Processing",
  "capture.deleteAsk": "Delete?",
  "capture.confirmDelete": "Confirm delete",
  "capture.cancel": "Cancel",
  "capture.uploadAgain": "Upload again",
  "capture.delete": "Delete",
  "capture.deleteCard": "Delete this card?",
  "capture.failedTitle": "Capture Failed",
  "capture.failedUnknown": "Unknown error occurred",
  "capture.close": "Close",
  "filter.all": "All",
  "filter.saved": "Saved",
  "filter.recommended": "Recommended",
  "list.inbox": "Inbox",
  "list.recent": "Recent",
  "action.must_read": "Must Read",
  "action.worth_reading": "Worth Reading",
  "action.skim": "Skim",
  "action.summary_only": "Summary Only",
  "action.skip": "Skip",
  "action.must_read.desc": "Every sentence counts",
  "action.worth_reading.desc": "Read key sections",
  "action.skim.desc": "Scan headings and key points",
  "action.summary_only.desc": "Just read the summary",
  "action.skip.desc": "Not worth your time",
  "time.justNow": "just now",
  "time.minutes": "{n}m ago",
  "time.hours": "{n}h ago",
  "time.days": "{n}d ago",
  "entry.added": "Added",
  "sample.middle": "\n\n[...middle omitted. Excerpt from the middle...]\n\n",
  "sample.end": "\n\n[...excerpt from the end...]\n\n",
  "pdf.password": "This PDF is password-protected. Remove the password and upload it again.",
  "pdf.unreadable": "This PDF could not be read.",
  "pdf.noText": "This PDF has no selectable text. It is probably a scan. Use an EPUB, or a PDF with a text layer.",
  "epub.container": "This EPUB is missing META-INF/container.xml",
  "epub.package": "This EPUB does not name its package file",
  "epub.missingPackage": "This EPUB's package file is missing",
  "epub.noText": "This EPUB has no readable text",
  "tagline.1": "You can't read everything. You don't have to.",
  "tagline.2": "The art of knowing what to ignore.",
  "tagline.3": "Not storage. Sense-making.",
  "tagline.4": "From noise to signal.",
  "tagline.5": "Information overwhelms. Your second brain evolves.",
  "tagline.6": "Free your judgment from information triage.",
} as const;

const zh: Record<keyof typeof en, string> = {
  "nav.home": "首页",
  "nav.today": "今日",
  "nav.history": "记录",
  "nav.user": "偏好",
  "nav.memory": "记忆",
  "nav.collapse": "收起侧栏",
  "nav.expand": "展开侧栏",
  "nav.library": "书架",
  "nav.libraryHint": "你收进来的",
  "nav.libraryEmpty": "还没有内容。在上面粘贴链接开始。",
  "nav.notebook": "笔记",
  "nav.notebookHint": "你和助手写下的",
  "nav.notebookEmpty": "还没有笔记。让助手从你的材料里写一份简报。",
  "view.welcome": "欢迎使用 Second Brain",
  "view.activity": "每日活动",
  "header.settings": "设置",
  "header.checking": "正在检查",
  "header.connected": "已连接",
  "header.disconnected": "未连接",
  "menu.delete": "删除",
  "menu.rename": "重命名",
  "settings.title": "设置",
  "settings.appearance": "外观",
  "settings.feed": "今日",
  "settings.agent": "助手",
  "settings.language": "语言",
  "settings.theme": "主题",
  "settings.font": "字体",
  "settings.light": "浅色",
  "settings.dark": "深色",
  "settings.system": "跟随系统",
  "capture.chooseFile": "选择文件",
  "capture.drop": "把文件拖到这里",
  "capture.note": "可以补一句备注",
  "capture.idle": "粘贴链接、文字，或点加号选择文件",
  "capture.unsupported": "目前可以上传图片、PDF 和 EPUB",
  "capture.processing": "正在处理",
  "capture.deleteAsk": "删除？",
  "capture.confirmDelete": "确认删除",
  "capture.cancel": "取消",
  "capture.uploadAgain": "重新上传",
  "capture.delete": "删除",
  "capture.deleteCard": "删除这张卡片？",
  "capture.failedTitle": "收藏失败",
  "capture.failedUnknown": "出现了未知错误",
  "capture.close": "关闭",
  "filter.all": "全部",
  "filter.saved": "已存",
  "filter.recommended": "推荐",
  "list.inbox": "待读",
  "list.recent": "最近",
  "action.must_read": "必读",
  "action.worth_reading": "值得读",
  "action.skim": "略读",
  "action.summary_only": "只看摘要",
  "action.skip": "跳过",
  "action.must_read.desc": "几乎每一句都值得看",
  "action.worth_reading.desc": "读关键部分",
  "action.skim.desc": "扫标题和要点即可",
  "action.summary_only.desc": "读摘要就够了",
  "action.skip.desc": "不值得花时间",
  "time.justNow": "刚刚",
  "time.minutes": "{n} 分钟前",
  "time.hours": "{n} 小时前",
  "time.days": "{n} 天前",
  "entry.added": "加入于",
  "sample.middle": "\n\n[……中间略去。以下是书的中段节选……]\n\n",
  "sample.end": "\n\n[……以下是结尾节选……]\n\n",
  "pdf.password": "这本 PDF 有密码，无法读取。请先去掉密码再上传。",
  "pdf.unreadable": "这本 PDF 无法读取。",
  "pdf.noText": "这本 PDF 没有可选中的文字。它多半是扫描版，请改用 EPUB，或先做成带文字层的 PDF。",
  "epub.container": "这不是一本可读的 EPUB：缺少 META-INF/container.xml",
  "epub.package": "这本 EPUB 没有标明目录文件",
  "epub.missingPackage": "这本 EPUB 的目录文件找不到",
  "epub.noText": "这本 EPUB 里没有提取到正文",
  "tagline.1": "你读不完所有东西，也不必读完。",
  "tagline.2": "知道什么该忽略，本身就是本事。",
  "tagline.3": "不是用来存放，是用来想清楚。",
  "tagline.4": "从噪音里留下信号。",
  "tagline.5": "信息会压过来。你的第二大脑可以跟着长。",
  "tagline.6": "把筛选从判断里拿开。",
};

export type MessageKey = keyof typeof en;

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, zh };

let activeLocale: Locale = "en";

export function setActiveLocale(locale: Locale) {
  activeLocale = locale === "zh" ? "zh" : "en";
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function normalizeLocale(value: unknown): Locale {
  return value === "zh" ? "zh" : "en";
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text = dictionaries[locale][key] ?? dictionaries.en[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(activeLocale, key, vars);
}

export function actionText(action: string, field: "label" | "desc" = "label"): string {
  const key = (field === "label" ? `action.${action}` : `action.${action}.desc`) as MessageKey;
  return key in en ? t(key) : action;
}

const errorKeys: Record<string, MessageKey> = Object.fromEntries(
  (Object.keys(en) as MessageKey[])
    .filter((key) => key.startsWith("pdf.") || key.startsWith("epub."))
    .map((key) => [en[key], key])
);

export function localizeError(locale: Locale, message: string): string {
  const key = errorKeys[message];
  return key ? translate(locale, key) : message;
}

export const AGENT_ZH_RULE = "【语言】凡是写给人阅读的文字，一律使用简体中文。JSON 键名、枚举值（must_read、worth_reading、skim、summary_only、skip、insight、fact、actionable、redundant、contradicts、related、recommend）和文件路径保持英文，不要翻译。";
