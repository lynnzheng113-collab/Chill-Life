# Chill Life

摆烂人生模拟器 / The Art of Doing Nothing

一个比赛用的交互式人生惯性模拟器。用户可以选择初始人设，连续做选择，也可以输入自己的真实想法；系统会把每次选择写入状态账本，生成路径节点，并在最后展示人生结果和关键路径。

## 本地启动

```bash
npm install
npm run dev
```

启动后打开终端里显示的本地地址，一般是：

```bash
http://localhost:5173/
```

## 接入 DeepSeek

复制一份本地环境变量文件：

```bash
cp .env.example .env.local
```

然后把 `.env.local` 里的 `DEEPSEEK_API_KEY` 换成你的 DeepSeek API Key：

```bash
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-v4-flash
```

再重新启动开发服务：

```bash
npm run dev
```

页面点击「生成我的路径」时，会先用本地规则秒出一条可玩的个人路径，同时在后台请求 `/api/deepseek-scenario`，由 Vite dev server 代理调用 DeepSeek。DeepSeek 成功后，如果用户还没开始选择，会自动替换成 AI 定制版；如果用户已经开始玩，本轮不会被打断。浏览器不会拿到 API Key。没有配置 Key 或接口失败时，会保留本地规则路径。

## 线上地址

已部署到 Cloudflare Pages：

```text
https://chill-life.pages.dev
```

GitHub Pages（仓库管理员启用 Pages 后生效）：

```text
https://lynnzheng113-collab.github.io/Chill-Life/
```

线上 DeepSeek Key 放在 Cloudflare Pages Secret 里，代码仓库不会提交真实 Key。需要更新线上 Key 时执行：

```bash
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name chill-life
```

重新部署：

```bash
npm run build
npx wrangler pages deploy dist --project-name chill-life --branch main
```

GitHub Pages 会在推送到 `main` 后通过 GitHub Actions 自动部署。GitHub Pages 是静态站点，DeepSeek 请求会调用 Cloudflare Pages 上的 `/api/deepseek-scenario`。

首次启用 GitHub Pages 需要仓库管理员打开 `Settings -> Pages`，把 `Build and deployment` 的 `Source` 设为 `GitHub Actions`，然后重新运行 `Deploy GitHub Pages` workflow。

## 常用命令

```bash
npm run dev      # 本地开发
npm run build    # 生产构建检查
npm run preview  # 预览构建结果
```

## 当前 MVP

- 前置人生画像：阶段、压力、目标、逃避模式、支撑关系、现金、健康、隐藏想法
- 画像定制路径：根据用户画像生成前几幕人生事件
- 3 个初始人设：上班第 2 年、自由职业、考研边缘
- 状态账本：精力、健康、现金、职业信用、关系余量、自我尊重、逃避惯性、机会窗口
- 路径沙盘：每次选择都会生成一个更长的人生记录节点
- 自由输入：根据输入内容识别行动倾向，并转化为状态变化
- 结果预测：实时展示不同人生结局的概率
- 最终报告：展示主导结局、关键拐点、最大收益和最大代价
- DeepSeek 接入：`generateScenarioWithLocalCodex(profile, persona)` 会调用本地代理接口，失败时回退本地规则

## 队友协作

```bash
git clone https://github.com/lynnzheng113-collab/Chill-Life.git
cd Chill-Life
npm install
npm run dev
```
