# Pivot Atlas · 宏观研究工作台

跨市场日线、传统枢轴、神奇九转与表现矩阵。51个标的、9类市场，Python HTTP服务 + 原生HTML/CSS/JavaScript，无前端构建依赖。

## 开发
需要 Python 3.12、curl；运行测试还需 Node.js 22。

```sh
git clone https://github.com/shancun-c/pivot-atlas.git
cd pivot-atlas
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
```
打开 http://127.0.0.1:8765/ 。`PORT`设置本地端口，`CACHE_DIR`设置行情缓存目录（默认`.cache`）。Node.js 22用于测试，不是网站运行依赖。

## 页面
- `/#board` 全球枢轴看板：市场筛选、周/月点位、来源及K线。
- `/#performance` 跨市场表现：单日/WTD/MTD/1M/3M/YTD及20期日波动，排序、搜索、市场筛选。价格百分比与国债bp独立比较。
- `/#structures` 九转观察：最新9、发展中6–8，点击核验K线。

## 检查
```sh
.venv/bin/python -m unittest discover -s tests -v
node --test tests/*.test.mjs
node --check public/app.js
```
GitHub Actions在push/PR执行相同检查。使用Python3.12以匹配锁定依赖。业务计算使用本地代码；CI不连接生产服务器。

## 模块
- `server.py`：API、缓存、失败退避和数据新鲜度。
- `providers.py`：Yahoo、腾讯、新浪、东方财富及Coinbase适配。
- `market_periods.py` / `pivots.py`：交易日历、完整性与枢轴公式。
- `public/chart.mjs`：原生SVG K线和九转算法。
- `public/performance.mjs`：表现计算、日期基准与排序。
- `public/performance-view.mjs`：表现矩阵页面。
- `public/structure-watch.mjs`：九转候选汇总。

## 口径与边界
矩阵保守排除来源时区当天日线。本周/本月/YTD以来源时区当前日期划定期间；若本期休市无新日线，基准与最新观测相同则变动为0，最新观测日期始终公开。近1/3月从最新已结束日线回溯日历月；比较日期见数字提示。价格表现不含分红、不转换共同本位币，连续期货换月和源数据调整可能影响回报。无效、缺失或过期数据不补零。不同市场不同收盘时间，排名是描述性比较。

见[首轮验收口径](docs/ITERATION-01.md)、[设计规范](DESIGN.md)、[历史记录](docs/HISTORY.md)。公开行情接口不保证实时或稳定，用户仍需核对数据源再分发许可。

## Git与部署
代码采用 [MIT License](LICENSE) 开源。第三方行情及依赖不因本许可证获得额外授权。缓存、密钥、虚拟环境、运行截图及服务器运行记录不入Git。
发布需先测试，将应用文件复制到独立release目录，再切换current软链接，仅重启本站；保留前一版和持久缓存。服务器私有运行记录留在本地deploy目录，不上传仓库。不设置自动生产部署。

## 跨资产对照（Iteration 02）
`/#comparison` 支持2–4个标的、30/90/180自然日窗口和宏观研究组合。日期取交集，价格起点100、收益率累计bp分面展示；显示区间变化、样本量及共同区间变动的Pearson相关性。少于20个变动样本不输出相关性。不代表同步收盘、因果或总回报。见[计算与验收口径](docs/ITERATION-02.md)。


## 宏观传导
`/#macro` 提供美国2Y收益率、10Y−2Y利差、10Y实际收益率、盈亏平衡通胀代理、NDX/SPX和COMEX铜金比。支持共同日期、90/180/365日窗口、利率与比值分解、近期变化、日期游标及CSV导出。数据来自美国财政部和行情适配器，不保证实时或持续可用。研究视角与日期保存在本机浏览器。

## 贡献与安全
提交修改前运行上述检查，PR说明触发条件、口径变化和验证结果。请勿提交真实缓存、账户数据、密钥或私人部署资料；测试使用合成样本。发现安全问题时不要在公开Issue中贴出敏感内容。

## 许可与使用边界
MIT许可证适用于本仓库代码，不覆盖第三方行情的抓取、展示、商业使用或再分发许可。使用者需自行核查各数据源条款。指标是描述性研究工具，不构成投资建议。
