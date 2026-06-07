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

## 常用命令

```bash
npm run dev      # 本地开发
npm run build    # 生产构建检查
npm run preview  # 预览构建结果
```

## 当前 MVP

- 3 个初始人设：上班第 2 年、自由职业、考研边缘
- 状态账本：精力、健康、现金、职业信用、关系余量、自我尊重、逃避惯性、机会窗口
- 路径沙盘：每次选择都会生成一个人生节点
- 自由输入：根据输入内容识别行动倾向，并转化为状态变化
- 结果预测：实时展示不同人生结局的概率
- 最终报告：展示主导结局、关键拐点、最大收益和最大代价

## 队友协作

```bash
git clone https://github.com/lynnzheng113-collab/Chill-Life.git
cd Chill-Life
npm install
npm run dev
```
