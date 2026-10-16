# PROWBench 指标归一化与总分计算

本文记录当前本地 Leaderboard 的计算规则：先将每个小项转换为 **0–100 分、越高越好**，再计算大项均分，最后对各大项等权平均得到总分。

对应实现：[Python 脚本](scripts/normalize_metrics.py)、[网页计算逻辑](leaderboard-core.js)。当前输入来自所提供 `PROWBench.zip` 的有效结果表，保存在 [leaderboard-data.js](assets/leaderboard-data.js)。本文中的自定义映射是当前排行榜采用的方案，并非 PROWBench 论文原有的官方总分协议。

以下 `x` 均指**论文表格报告的模型均值**，使用表格中的单位和尺度。`S` 表示归一化分数；所有有效结果最后统一裁剪：

```text
clip(y, 0, 100) = min(100, max(0, y))
S = clip(公式结果, 0, 100)
```

公式中的 `π` 为圆周率。下表中的例子用于说明换算，不表示同一个模型的完整评测结果。

| 大项 | Metric / 代码 ID | 输入值的含义或单位 | 归一化公式 | 换算示例 |
| --- | --- | --- | --- | --- |
| Entity control | BBox IoU / `iou` | 框重叠比例，范围 `[0,1]` | `100 × x` | `0.354 → 35.4` |
| Entity control | CErr / `cerr` | 已按图像对角线归一化的中心误差，越小越好 | `100 / (1 + x)` | `0.25 → 80.0` |
| Entity control | Miss → Detection / `miss` | 漏检率，范围 `[0,1]`；仅多视角设置报告此项 | `100 × (1 − x)` | `0.192 → 80.8` |
| Logic / state | ISR / `isr` | 交互成功率，范围 `[0,1]` | `100 × x` | `0.5 → 50.0` |
| Logic / state | LRA / `lra` | 逻辑与渲染对齐比例，范围 `[0,1]` | `100 × x` | `0.680 → 68.0` |
| Logic / state | gISR / `gisr` | 论文已报告的 IoU 加权 ISR，范围 `[0,1]` | `100 × x` | `0.170 → 17.0` |
| Logic / state | gLRA / `glra` | 论文已报告的 IoU 加权 LRA，范围 `[0,1]` | `100 × x` | `0.242 → 24.2` |
| Camera control | RotErr / `rot` | 旋转误差，表格单位为**度**，越小越好 | `100 / (1 + π × x / 180)` | `57.2958° ≈ 1 rad → 约 50.0` |
| Camera control | TransErr / `trans` | 轨迹归一化后的平移误差，越小越好 | `100 / (1 + x)` | `1.0 → 50.0` |
| Camera control | CamMC / `cammc` | 平移部分归一化后的姿态矩阵 Frobenius 距离，越小越好 | `100 / (1 + x)` | `0.25 → 80.0` |
| Visual quality | Img / `img` | MUSIQ 分数，表格已使用约 `0–100` 的尺度 | `x` | `68.1 → 68.1` |
| Visual quality | Aes / `aes` | 已除以 10 的 LAION aesthetic 分数，表格值为 `0–1` 尺度 | `100 × x` | `0.609 → 60.9` |
| Temporal quality | Warp / `warp` | 像素差除以 255 后，遮挡掩码下的 RGB 通道平均平方误差；表格报告 `1000 × MSE` | `100 × (1 − sqrt(x / 1000))` | `0.647 → 97.4564`，网页显示 `97.5` |
| Temporal quality | Smooth / `smooth` | 已计算好的 VBench 平滑度分数，范围 `[0,1]`，越高越好 | `100 × x` | `0.987 → 98.7` |
| Text alignment | CLIP-Score / `clip` | 表格已经报告 `100 × cosine_similarity` | `clip(x, 0, 100)` | `25.2 → 25.2`；`−2 → 0` |
| Memory | Re-IoU / `re_iou` | 目标重新出现后的框重叠比例，范围 `[0,1]` | `100 × x` | `0.25 → 25.0` |
| Memory | Re-State / `re_state` | 可判断返回事件中的状态正确比例，范围 `[0,1]` | `100 × x` | `0.8 → 80.0` |
| Multi-view consistency | Comp. / `comp` | 外观符合描述的百分数，表格已乘以 100 | `x` | `83.4 → 83.4` |
| Multi-view consistency | Cons. / `cons` | 跨视角外观一致性的百分数，表格已乘以 100 | `x` | `75.8 → 75.8` |
| Multi-view consistency | MEt3R / `met3r` | 按余弦距离范围 `[0,2]` 处理，越小越好 | `100 × (1 − x / 2)` | `0.397 → 80.15`，网页显示 `80.2` |

**输入单位与映射依据。** Img、Aes、Smooth 沿用 WBENCH 的缩放方式。Aes 的输入必须是论文中已经除以 10 的值；如果拿到的是 LAION 原始 `6.09`，应先换成 `0.609` 再使用此公式。Img、CLIP、Comp.、Cons. 不再额外乘以 100。

CErr、TransErr、CamMC 使用借鉴 WBENCH 误差映射形式的固定倒数方案；RotErr 先将度转换为弧度，再使用同一形式。这些是当前排行榜的自定义映射，不是 WBENCH 的 NavScore。公式中的尺度常数固定为 1，不根据模型结果调整。TransErr 的输入已经按每条轨迹自身的最大位移归一化，不应直接代入以米为单位的平移误差。MEt3R 则采用距离范围的反向线性映射，距离 `0、1、2` 分别对应 `100、50、0` 分。

**gISR / gLRA 保留来源中的原始聚合值。** 两项均直接使用表格中的数值乘以 100，不在排行榜中重算。原因是它们先逐样本相乘，再对样本求平均：

```text
gISR = mean(IoU_sample × ISR_sample)
gLRA = mean(IoU_sample × LRA_sample)

一般情况下：
mean(IoU_sample × ISR_sample) ≠ mean(IoU_sample) × mean(ISR_sample)
```

**Warp 的计算口径与转分。** 已核对本地评估仓库的 `eval/prowbench_eval/metric_temporal.py`：相邻生成帧经光流对齐后，像素差先除以 `255` 再平方，并对 RGB 通道取均值；随后对非遮挡像素取均值，再对有效帧对取均值，最终乘以 `1000` 报告。本榜采用这一口径解释论文表格的 Warp 均值，归一化像素范围为 `1`，不再除以 `255` 或额外除以 `3`。

```text
MSE = x / 1000
normalized_RMSE = sqrt(MSE)
S_Warp = clip(100 × (1 − normalized_RMSE), 0, 100)
Temporal quality = (S_Warp + S_Smooth) / 2
```

此公式已用于 Verified-FF、Unverified-FF、Gunfight 的小项分数、大项均分与总排名。Long-horizon、Multi-view 没有评测 Warp，也没有 Temporal quality 大项，不为这两组补入分数或增加分母。

这是自定义的归一化 RMSE 展示转换，不是论文原有的官方百分制，也不表示人眼质量百分比。当前 25 个 Warp 汇总值转换后为约 `95.91–98.97` 分。与其他非线性映射一样，此处先对报告的模型均值开根号，即 `f(mean(x))`，不等于逐视频转换后平均。原始值仍完整保留；Warp 缺失或无效时，其 Temporal quality 和总分均不计算。

**大项如何平均。** 下表中的 `S_指标` 均指已经按上表转换并裁剪后的分数。

| 大项 | 当前计算方式 |
| --- | --- |
| Entity control（Verified-FF、Unverified-FF、Long-horizon、Gunfight） | `(S_IoU + S_CErr) / 2` |
| Entity control（Multi-view） | `(S_IoU + S_CErr + S_Detection) / 3` |
| Logic / state | `(S_ISR + S_LRA + S_gISR + S_gLRA) / 4` |
| Camera control | `(S_RotErr + S_TransErr + S_CamMC) / 3` |
| Visual quality | `(S_Img + S_Aes) / 2` |
| Temporal quality | `(S_Warp + S_Smooth) / 2` |
| Text alignment | `S_CLIP` |
| Memory | `(S_Re-IoU + S_Re-State) / 2` |
| Multi-view consistency | `(S_Comp + S_Cons + S_MEt3R) / 3` |

**总分如何平均。** 每个评测设置分别计算总分和排名，只使用该设置实际评测的大项：

| 评测设置 | 计入总分的大项 | 总分计算 |
| --- | --- | --- |
| Verified-FF | Entity、Logic、Camera、Visual、Temporal、Text | 6 个大项分数相加后除以 6 |
| Unverified-FF | Entity、Logic、Camera、Visual、Temporal、Text | 6 个大项分数相加后除以 6 |
| Long-horizon | Entity、Logic、Memory、Camera | 4 个大项分数相加后除以 4 |
| Multi-view | Entity、Logic、Multi-view consistency、Camera | 4 个大项分数相加后除以 4 |
| Gunfight | Entity、Logic、Camera、Visual、Temporal、Text | 6 个大项分数相加后除以 6 |

例如，假设某设置只包含 Entity 和 Logic 两个大项。Entity 的两个小项分数为 `20、50`，大项均分为 `35`；Logic 的四个小项分数为 `80、60、40、20`，大项均分为 `50`。总分为 `(35+50)/2=42.5`。这保证两个大项等权，而不是直接对六个小项求平均得到 `45`。

**精度、缺失值及分数解释。**

- 小项转换、大项平均和总分平均均使用未四舍五入的数值；计算完成后，网页显示小项 1 位小数、大项及总分 2 位小数，JSON 导出保留完整精度。
- 归一化公式固定，不根据当前模型集合做 min-max；筛选模型、切换显示列、切换原始值视图均不会改变总分。原始值视图中的大项和总分仍使用归一化分数计算。
- 缺失值、非数值、布尔值、非有限值，以及除 CLIP 外的负输入，均不转换为有效分数。任何必需小项（包括 Warp）缺失时，其大项分数和总分均为 `None/null`，不通过缩小平均分母处理。
- 未在某个设置中评测的大项不加入该设置的总分分母；这与某个模型缺失了必需的小项是两种情况。
- CErr 以检测到目标为条件；Re-State 以可判断返回事件为条件；Comp.、Cons. 以可判断观测为条件。百分制换算不会消除这些条件，应结合 IoU、Detection 等覆盖指标阅读结果。
- 当前输入为论文报告的模型均值。因此，倒数、Warp 的开根号等非线性转换计算的是 `f(mean(x))`，一般不等于逐视频转换后再平均的 `mean(f(x))`；当前分数属于汇总值的展示转换。

在仓库根目录运行以下命令，可以查看公式并导出结果：

```bash
# 逐项打印公式、输入单位和依据
python3 scripts/normalize_metrics.py --explain

# 导出原始值、小项分数、大项均分、总分及排名
python3 scripts/normalize_metrics.py --output ../normalized-results.json
```

Python 与网页 JavaScript 的一致性检查覆盖 470 个小项值、190 个大项分数、35 个总分及排名。复核命令：

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p 'test_*.py'
```
