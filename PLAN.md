# 网站调研功能实现方案

## 功能概述

用户输入一个网址，系统自动抓取网站内容，通过 AI 进行多维度深度分析，输出结构化的调研报告。

## 分析维度（从整体到细节）

1. **产品概览** - 网站定位、核心功能、解决什么问题
2. **产品设计分析** - 功能架构、交互设计、技术栈推断
3. **用户画像** - 目标用户群体、使用场景、用户需求
4. **商业模式** - 变现方式、定价策略、盈利逻辑
5. **优势分析** - 产品亮点、竞争壁垒、差异化
6. **劣势分析** - 不足之处、用户痛点、改进空间
7. **市场机会** - 可借鉴之处、市场空白、创业启发

## 技术方案

### 1. 数据库 - 新增 `siteResearches` 表

```
siteResearches:
  id          - 自增主键
  url         - 目标网址
  domain      - 提取的域名
  title       - 网站标题
  status      - pending / crawling / analyzing / completed / failed
  pageContent - 抓取的页面内容（纯文本）
  aiAnalysis  - AI 分析结果（JSON）
  errorMessage- 失败原因
  ideaId      - 可选，关联到某个 idea
  createdAt
  updatedAt
```

### 2. 后端 - 网页抓取 + AI 分析

**抓取策略：**
- 用 `fetch` 获取目标 URL 的 HTML
- 解析 HTML 提取纯文本内容（标题、正文、导航、页脚）
- 自动发现并抓取关键子页面（/about、/pricing、/features，最多 5 个）
- 合并所有页面内容作为 AI 分析输入

**AI 分析：**
- 复用现有 `createAIProvider('analysis')` 模式
- 使用 analysis 模型（Claude Sonnet）进行深度分析
- 单次 AI 调用，结构化 JSON 输出
- 通过 `withBudgetCheck` 控制预算

### 3. API 路由

- `POST /api/site-research` - 提交 URL 开始分析
- `GET /api/site-research` - 获取分析列表
- `GET /api/site-research/[id]` - 获取单个分析详情

### 4. 前端页面

**新增 `/research` 页面：**
- 顶部：URL 输入框 + "开始分析" 按钮
- 分析中：进度提示（toast loading）
- 分析完成：结构化报告卡片展示（7 个维度）
- 底部：历史分析记录列表

**侧边栏新增"网站调研"入口。**

## 涉及文件变更

| 操作 | 文件 |
|------|------|
| 新增 | `src/lib/db/schema.ts` (新表) |
| 新增 | `src/lib/research/crawler.ts` (网页抓取) |
| 新增 | `src/lib/research/analyzer.ts` (AI 分析) |
| 新增 | `src/app/api/site-research/route.ts` |
| 新增 | `src/app/api/site-research/[id]/route.ts` |
| 新增 | `src/app/research/page.tsx` |
| 修改 | `src/components/layout/sidebar.tsx` (加入口) |
| 修改 | DB migration (push schema) |
