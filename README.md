# 枢轴观测站 · Pivot Atlas

本地可运行的多市场枢轴点网站。目录包含原图全部 48 个标的、8 个分组；采用真实日线，没有演示行情或模拟值。

## 运行

需要 Python 3.10+、curl 和系统时区数据库；当前验证环境为 macOS / Python 3.12。交易日历依赖 pandas_market_calendars 5.4.0；前端无第三方运行依赖。

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
```

打开 http://127.0.0.1:8765 。可通过 `PORT=8766 .venv/bin/python server.py` 改端口。服务仅监听本机。此版本没有部署到公网，也不是生产服务。

## 功能

- 8 类市场分组、名称/代码搜索、周度/月度/双周期对照。
- Traditional 的 P、R1–R5、S1–S5；默认显示三级，可展开五级。
- 资产详情：真实日 K 线叠加按周期分段的周/月枢轴点位；20/40/65 根切换、三级/五级点位、逐根 OHLC 读数。
- 原始 H/L/C、周期边界、可用日线数量和数据来源保留在图下。
- 浏览器本地关注列表、当前筛选结果 CSV 导出。
- 宽屏与手机布局，表格内横向滚动，资产名称固定。
- 15 分钟服务端缓存、最大 4 个并发上游请求，失败时显式使用旧缓存；无缓存则显示错误。

## K 线功能更新（2026-10-04，北京时间）

点击表格资产名称打开图表。蜡烛使用上游真实开高低收；所有点位与表格来自同一计算结果，没有重新取整计算。历史点位仅绘制在各自适用周期；下期点位仅绘制在右侧预览区，避免将未来计算结果延伸到历史。窄屏默认展示最新日线和右侧点位，可横向滑动。

开盘价补充涉及 `providers.py` 的 Yahoo、东方财富、新浪映射，以及 `server.py` 的缓存版本升级。旧缓存自动重新取数；失败时旧数据仍明确标记，缺少开盘价的柱只绘灰色高低线和收盘刻度，不虚构蜡烛实体。国债收益率没有真实开盘价，使用日观测折线叠加相同枢轴点位。

前端改动为 `public/app.js`、`index.html`、`style.css` 与新增 `chart.mjs`。使用原生 SVG，无新第三方运行依赖；现有接口字段沿用先前查证的资料。测试文件新增 `tests/chart.test.mjs`、`test_open_mapping.py`，扩展 `test_pivots.py` 和 `test_service.py`。

本次实际运行 **18 项 Python + 8 项 JavaScript 测试，全部通过**，JavaScript 语法和 Python 编译检查通过。实测恒指和沪金均返回 65 根具有真实开盘价的历史日线；国债返回日观测序列。浏览器验证了恒指40根/20根、月度/周度、11条点位线、单根 OHLC 读数以及国债折线；390px 手机无全页横向溢出。截图见 `preview-candles.png` 与 `preview-candles-mobile.png`。

## 首版验收记录（2026-10-04，北京时间）

48 个标的全部建档。最终浏览器页面显示 **47 个已取得日线，47 套周度和 47 套月度价位**。这不等于 48 个行情接口全部可用。

美元兑离岸人民币（USDCNH）仍未稳定接通：东方财富 `133.USDCNH` 探测曾返回历史数据，但后续出现 TLS EOF / 空响应；Yahoo CNH/USDCNH 历史日线不足。没有用在岸人民币代替，也没有填入模拟数据。两轮排查后保留错误状态，后续需要恢复此来源或更换具备 USDCNH 历史 OHLC 的供应商。

- 已运行 12 项单元测试：公式复算、非法输入、负值、跨年跨月、闰月、排除当期、不冒用旧周期、日线清洗，以及缓存/失败行为。
- 已运行 Python 编译和 JavaScript 语法检查。
- 浏览器验证：搜索、周月双行、五级价位、资产计算详情、关注状态。
- 响应式验证：1440×1000 桌面和 390×844 手机；手机 document 宽度为 390，没有全页横向溢出。
- CSV 导出已实现，点击后的自动下载事件等待超时，**文件落盘尚未确认**。
- ETF 参考沿用原图中的部分代码作静态参考，没有逐一验证当前基金状态或完整复刻全部备注。

## 数据和计算口径

Yahoo Finance 为国际指数、ETF、外汇和海外期货提供日线；新浪用于沪金/沪银主连及现货黄金/白银；东方财富为港股指数、部分 A 股指数及国债收益率提供数据。

以对应交易日历时区确定自然周/月，周界为周一。默认“交易参考”：本期最后交易日收盘满 15 分钟、行情获取时间晚于该时刻且源周期交易日日线齐全时，展示下期点位；否则保留本期并显示原因。“本期回看”始终使用当前自然周期对应的上一周期数据。选择在加载或手动刷新时重新计算，周、月分别判断。

已映射港股、A 股、美股、日经、韩国及部分 CME 商品日历。国内期货、现货金银、外汇和国债日观测尚无已核验的供应商日历，保守沿用自然周期，不提前切换。已映射品种若源周期缺失任一应有交易日日线，则不输出该套点位。15 分钟是发布缓冲，并非供应商的最终行情确认标记。

股票/ETF 不使用股息前复权，拆股处理遵循上游；期货采用上游连续序列，不保证与原图主力切换规则一致；国债收益率采用日观测值，其高低是日观测极值而非盘中收益率极值。报价大于 7 个自然日未更新标记旧数据，节假日可能触发。最新日线可能包含尚未结束的当日柱，但它不会进入当前周/月枢轴计算。

原图 EUV 的中文名称为“光通信”，Yahoo 返回名称为 Corgi Lithography & Semiconductor，页面已标出这一差异。ALmain 映射至 Yahoo ALI=F 铝期货。

这些是公开网页行情接口，没有 SLA，可能限流/改变。当前是本地研究版本；公开部署及行情再分发需要确认数据供应商授权。尚未实现认证、后台调度、云端用户数据同步和生产级服务运维。

## 文件

- `public/index.html`、`style.css`、`app.js`：页面及交互。
- `assets.json`：48 个标的、分组、接口代码与口径备注。
- `providers.py`：Yahoo / 新浪 / 东方财富适配。
- `pivots.py`：传统枢轴公式、日历周期聚合。
- `server.py`：本机 HTTP API、缓存与请求并发限制。
- `market_periods.py`：交易日历、数据完整性、两种用途和历史分段。
- `requirements.txt`：锁定日历依赖及其传递依赖。
- `tests/`：业务与回归测试。
- `.cache/`：运行时真实行情缓存，可删除；不应打包为固定行情。

## 文档依据

公式核对自 [TradingView Traditional](https://www.tradingview.com/support/solutions/43000521824-pivot-points-standard/)。中国市场接口字段经 [Context7 / AKShare](https://context7.com/akfamily/akshare) 与 AKShare 当前源码核对；未安装或依赖 AKShare。

- [国内期货字段](https://github.com/akfamily/akshare/blob/main/akshare/futures/futures_zh_sina.py)
- [海外及现货商品字段](https://github.com/akfamily/akshare/blob/main/akshare/futures/futures_foreign.py)
- [国债收益率字段](https://github.com/akfamily/akshare/blob/main/akshare/bond/bond_em.py)
- [外汇历史接口](https://github.com/akfamily/akshare/blob/main/akshare/forex/forex_em.py)

## 检查

```sh
 .venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m py_compile server.py providers.py pivots.py market_periods.py
node --check public/app.js
node --test tests/chart.test.mjs
```

## 交易参考更新验收（2026-10-04）

新增 `market_periods.py`、日历依赖及周期测试，调整 `server.py`、前端页面/样式/图表和本说明。已运行 27 项 Python 与 10 项 JavaScript 测试，全部通过，覆盖提前休市、节假日、夏令时、月末、日线缺失和未来点位不穿越历史；语法/编译检查通过。

恒指交易参考周轴心为 24,201.61（按原图一位小数为 24,201.6），本期回看为 24,679.92；月度轴心仍为 24,893.40。浏览器验证了表格和详情两种用途切换。完整性校验比首版严格，原先 47 套点位的记录仅代表首版验收，不代表当前所有周期仍有足够日线。

日历调用已通过 Context7 及 [官方 usage 文档](https://pandas-market-calendars.readthedocs.io/en/stable/usage.html) 核对 `get_calendar` 和 `schedule` 的 UTC 收盘时间。截图：`preview-trading-reference.png`。

### 数据获取修复（2026-10-04）
- 恒生科技、上证、创业板、沪深300、中证A500、科创50使用明确同标的的腾讯未复权日线映射，东方财富作为后备；不使用 ETF 替代指数。
- 离岸人民币使用新浪 `fx_susdcnh` 日线，按供应商 SDK 的 date/open/low/high/close 顺序解析 JSONP 字符串，不执行脚本。其交易日界尚未核验，保留供应商日期，UTC 仅用于日期处理。
- 普通加载复用15分钟缓存；刷新按钮带 `refresh=1` 请求上游。失败退避60秒，保留旧数据及原获取时间；禁止上游日期倒退覆盖缓存。
- 已知市场按交易日历最近收盘后15分钟检查日线日期；未知日历仍保留7自然日提示。刷新失败和日线滞后分别标记。
- 接口字段依据：[AKShare 腾讯指数适配器](https://github.com/akfamily/akshare/blob/master/akshare/index/index_stock_zh.py)、[新浪官方行情 SDK](https://finance.sina.com.cn/sinafinancesdk/js/datas/k.js)。Context7检索用于核对接口资料，没有新增运行时依赖。
- 本次逐项网络核验保存在 `data-verification.json`。公开接口仍可能超时；恒生生物科技未找到已验证的同标的完整OHLC备用源。

### 加密货币
新增 BTC/USD、ETH/USD、SOL/USD，市场总数为9、资产总数为51。使用 Coinbase Exchange 现货日线，UTC 00:00 划分每天，24/7 日历包含周末；仅纳入已结束日线。周线按周一至周日、月线按自然月计算，缺失任一天则不生成对应周期点位。价格为该交易所美元现货价格，不是 USDT 报价或跨交易所综合价。

适配依据：[Coinbase Get product candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles)，字段为 timestamp/low/high/open/close/volume，使用86400秒粒度、220天时间范围并过滤未结束日线。未新增第三方依赖。实测数据见 `crypto-verification.json`。

### 神奇九转（2026-10-06，同花顺显示逻辑）
收盘价连续严格高于或低于前第4根；1–5不显示，第6根回标1–6，第7、8根继续满足则追加，未到9就中断则整组撤销；完成9后保留，同向延伸不重复计数。相等、反向或非法值中断序列。历史左边界须有可观察的方向转换，避免人为制造起点。

当日日线参与计算，相关九转标记仍可能变化，达到9也标记当日待确认；发展中的6–8不会被描述为完成结构。前5根为回溯标注，不应当作当时已知的信号。不包含13倒计时或完善条件。按全部可用历史计算再截取20/40/65根显示，适用于所有标的；收益率仍显示折线。

按用户提供的同花顺手册5.4.1实现显示规则。未引入第三方依赖，无需版本相关API调整。修改public/chart.mjs、public/app.js、public/index.html、tests/nine.test.mjs及本说明。

发布目录：/srv/pivot-atlas/releases/20261006-td9-ths；回滚目录：/srv/pivot-atlas/releases/20261006-td9-confirmed。仅切换current软链接并重启pivot-atlas；不修改Nginx、其他服务或缓存。

### 首页九转观察（2026-10-06）
新增public/structure-watch.mjs及tests/structure-watch.test.mjs；调整public/app.js、index.html、style.css。汇总最新日线仍处于6–8的发展中序列，按8/7/6排序，排除缓存/失败/缺失行情。默认展示前6项，可展开全部，点击打开K线。共23项JS测试通过，app.js语法检查通过；390px浏览器宽度等于文档宽度，详情关闭后焦点回到候选行。未新增依赖或第三方API。
发布使用独立目录20261006-structure-watch；回滚为20261006-td9-ths，仅重启本站。

### 最新九转完成提示（2026-10-06）
首页增加独立的“最新达到9”列表，排在发展中6–8之前。仅最新日线的数字为9时纳入；旧的9不持续提示，失效行情排除。当日9标记未确认，日期已结束的9显示完成。public/structure-watch.mjs、app.js、index.html、style.css和汇总测试更新；25项JS测试通过，JS语法检查通过。发布20261006-watch9，上一版20261006-structure-watch保留供回滚。

### 工作空间页面分离（2026-10-06）
九转观察移至独立哈希路由/#structures，与/#board看板同级。左侧工作空间新增入口，手机新增页面导航。市场分类自动进入看板并清除搜索/状态筛选后应用市场条件。九转算法不变。修改public/app.js、index.html、style.css；25项JS测试及语法检查通过。浏览器验证市场筛选（美股12）、返回、刷新恢复和390px手机入口/无横向溢出。
发布20261006-pages，回滚目录20261006-watch9。
