# CLOT / FLOW — 最终可执行方案母版

> C5 · Week 6 · COMP4020
> 本文件是唯一权威规格。所有交给 Claude Code 的 prompt 都以本文件为准。
> Claude 不得自行扩展 scope、添加教程文字、或跳步执行。

---

## 0. 一句话

一条受损血管正在流血。你把血小板拖到伤口上形成血栓。
血小板不足 → 失血；血小板过多 → 堵塞血管。

**The player first learns to make a clot, then learns when to stop.**

---

## 1. 四条不可违背的原则

| 原则 | 含义 |
|---|---|
| **One mechanic** | 全游戏只有一个主动操作：拖动血小板到伤口。不加技能、道具、按钮、键盘、升级、HUD。 |
| **No tutorial** | 任何位置（屏幕、README、tooltip、图例）都不得出现说明玩法的文字。 |
| **Failure must feel fair** | 玩家必须在失败前从画面上看见自己正在走向失败。 |
| **Tests ≠ human judgement** | 自动测试证明规则没坏；真人试玩判断好不好玩、公不公平、直不直观。 |

**允许出现的文字，仅限：** `CLOT / FLOW`、`STABLE`、`BLEEDING`、`BLOCKED`、`FLOW 87%`、`↻`

**判断新元素是否该加，问三个问题：**
1. 它是否让第一次操作更明显？
2. 它是否让「止血 vs 堵塞」的判断更有趣？
3. 它是否让失败更容易从画面被预判？

三个都不是 → 不加。**任何能用动画、位置、颜色、时机、affordance 解决的问题，禁止用说明文字解决。**

---

## 2. 规则模型（唯一权威定义）

### 2.1 状态：只有 4 个会积分的量

```ts
type Outcome = "playing" | "stable" | "bleeding" | "blocked";

type GameState = {
  clot: number;        // 血栓大小 0..1+  玩家 +，纤溶 −
  woundSize: number;   // 伤口大小 0..1   仅在封堵良好时下降
  bloodVolume: number; // 血量     0..1   单调下降
  elapsed: number;     // 秒
  oxygenIntegral: number; // 用于最终 FLOW 分数
  outcome: Outcome;
};
```

**其余全部是纯派生函数（selector），不得存进 state。**
渲染层只读 state 和 selector。**Renderer never owns the rules.**

### 2.2 派生量

```ts
leak(s)   = max(0, s.woundSize - s.clot)              // 出血速率因子
lumen(s)  = clamp01(1 - s.clot * LUMEN_COST)          // 剩余管腔
flow(s)   = lumen(s) ** 2                             // 非线性：越窄越陡
oxygen(s) = flow(s) * s.bloodVolume                   // 下游供氧 = 组织亮度
sealQ(s)  = clamp01(1 - leak(s) / HEAL_LEAK_TOL)      // 封堵质量 0..1

amp(t)    = lerp(PULSE_AMP_START, PULSE_AMP_END, clamp01(t / PULSE_RAMP))
pulse(t)  = 1 + amp(t) * max(0, sin(2π t / PULSE_PERIOD)) ** 3
```

### 2.3 更新（每帧，dt 秒）

```ts
addPlatelet(s)  =>  { ...s, clot: s.clot + PLATELET_SIZE }

updateGame(s, dt):
  clot           -= LYSIS_BASE * (0.3 + 0.7 * flow(s)) * pulse(s.elapsed) * dt   // 纤溶
  clot            = max(0, clot)
  bloodVolume    -= leak(s) * BLEED_RATE * dt
  woundSize      -= HEAL_MAX * oxygen(s) * sealQ(s) * dt                          // 愈合需要供氧
  elapsed        += dt
  oxygenIntegral += oxygen(s) * dt
  outcome         = evaluateOutcome(next)
```

### 2.4 结局（按此顺序判定）

```ts
evaluateOutcome(s):
  if (s.woundSize   <= 0)         return "stable";
  if (s.bloodVolume <= 0)         return "bleeding";
  if (lumen(s)      <= LUMEN_MIN) return "blocked";
  return "playing";
```

一旦 outcome ≠ "playing"，停止一切更新。

### 2.5 分数（仅结束画面显示）

```ts
flowScore(s) = round(100 * s.oxygenIntegral / s.elapsed)   // "FLOW 87%"
```

### 2.6 常量初值（全部是试玩要调的旋钮）

```ts
WOUND_INITIAL    = 0.50   // 需 5 枚血小板才封堵
BLOOD_INITIAL    = 1.00
PLATELET_SIZE    = 0.10
LUMEN_COST       = 0.90
LUMEN_MIN        = 0.25   // 封堵时 lumen≈0.55；堵死需 clot≈0.83（约多放 3.3 枚）
BLEED_RATE       = 0.066  // 完全不操作约 30 秒失血致死
HEAL_MAX         = 0.030
HEAL_LEAK_TOL    = 0.02
LYSIS_BASE       = 0.015
PULSE_PERIOD     = 4.0
PULSE_AMP_START  = 0.30
PULSE_AMP_END    = 1.50
PULSE_RAMP       = 90
PLATELET_SPAWN   = 1.0    // 秒；同屏 3–4 枚
```

---

## 3. 逻辑自检（已验证，勿改动机制）

| 检查 | 结果 |
|---|---|
| 开局不操作 | leak 0.5 → 约 30 秒 BLEEDING。给陌生人足够时间发现拖拽，又有真实压力。 |
| 放第 1 枚 | leak 0.5→0.4，漏血肉眼变少；lumen 1→0.91，红细胞略慢。**即时正反馈成立。** |
| 放满 5 枚 | leak=0，漏血停止；lumen 0.55，红细胞明显变慢；伤口开始可见地合拢。**核心 aha 时刻。** |
| 多放 3 枚 | clot 0.83 → lumen ≤0.25 → BLOCKED。恐慌乱放会死，且过程中红细胞持续减速可预判。 |
| **退化策略：一次放 8 枚然后不动** | **已封堵。** 愈合速率 ∝ oxygen，clot 过大 → flow 0.06 → 愈合几乎停止（需 200s+），而脉搏最终会把 clot 冲开导致失血。过度凝血赢不了。 |
| occlusion 单向棘轮 | **已封堵。** 纤溶让 clot 持续下降，「等待」是真实策略；但等太久伤口重新裂开。 |
| 胜利可否预判 | 可以。伤口在画面上一点点合拢就是进度条，无需计时器或数字。 |
| 难度曲线 | 前期伤口大 → 需要大 clot → **堵塞风险高**；后期伤口小、脉搏强 → **失血风险高**。两段张力由公式自然产生，无需脚本关卡。 |
| 精通表现 | 用尽可能小的 clot 维持封堵 → oxygen 最高 → 愈合最快 + FLOW 分最高。单一技能轴，越练越准。 |
| 一局时长 | 良好操作约 60–90 秒愈合完成。 |

**核心生理映射（不是装饰，是规则本身）：**
血栓同时封堵伤口和占据管腔；纤溶随血流剪切力溶解血栓；组织愈合需要氧气，而氧气需要血流。

---

## 4. 交互与 affordance

### 4.1 开场（0–10 秒）

无菜单、无 Start 按钮，直接进入游戏。

- 横贯屏幕的一条血管，红细胞持续从左向右流动
- 血管壁上一个明显裂口，正在向外渗血，轻微脉动发光
- 血小板从左侧随血流缓慢飘入（**比红细胞慢、更亮、更小、形状不规则**），飘过屏幕后从右侧消失
- `CLOT / FLOW` 短暂出现后淡出，无副标题

> 血小板跟着血流进入，同时解决四件事：来源合理、天然资源限制（错过就没了）、运动物体更吸引点击、以及「血小板可交互 / 红细胞不可交互」通过运动方式的差异被无字说明。

### 4.2 拖拽

| 阶段 | 表现 |
|---|---|
| Hover | 血小板放大、轻微朝光标偏移、glow 增强、cursor 变化。**不出现 tooltip。** |
| Pointer down | 立即跟随光标，无延迟。**实际 hit area 明显大于可见图形。** |
| 靠近裂口 | 远距离轻微吸引 → 中距离明显偏向 → 近距离快速吸附；裂口 glow 同步增强 |
| Release（吸附范围内） | 短促 glide 滑入 →「啪」地稳定；轻微 scale 压缩；新增 fibrin 线；漏血立刻下降；一声短音 |
| Release（范围外） | **血小板回到漂流状态，不消失**（避免挫败） |

**规则：**
- 同时只能持有一枚血小板
- **血小板放上去不可取回**（不可逆是「什么时候停」有意义的前提）
- 可以一直握着不放 → 熟练玩家会「留一枚在手上等下一次脉搏」，这是零成本的精通深度

### 4.3 Idle hint（冷玩保险，必做）

**若 5 秒内无任何指针交互：** 离裂口最近的一枚血小板朝裂口方向轻微漂移后弹回，同时裂口 glow 加强一拍。每 5 秒重复直到玩家首次交互。

无文字、无 UI、不暂停 —— 但它把「这两个东西有关系」直接演给玩家看。pod 冷玩测试的成败就在这 5 秒。

### 4.4 结束

- 三种结局各有一段短过渡（见 §5），然后显示结局词 + `FLOW 87%` + 一个非常明显的 `↻`
- 点击 `↻` 立即重开。**不要主菜单、不要 Play again?、不要提示、不要解释**

---

## 5. 视觉：预警系统

红细胞是唯一的仪表盘。游戏过程中**不显示任何数字**。

| 量 | 视觉承载 |
|---|---|
| flow | 红细胞速度、间距、是否在血栓上游排队 |
| oxygen | **下游组织亮度**（两种失败都会让它变暗——单一读数，两种死法） |
| bloodVolume | 血管颜色变淡、脉搏减弱、红细胞总数减少 |
| clot | fibrin 网增密、血栓向管腔内凸出、颜色更暗更实 |
| woundSize | 裂口开口宽度（= 进度条）；供氧良好时边缘有细微「织合」动画 |

**BLOCKED 前：** 血栓明显凸出 → 红细胞减速 → 上游排队 → 下游变暗 → 完全停止
**BLEEDING 前：** 血滴变多 → 血管变淡 → 脉搏变弱 → 画面失去活力
**STABLE 时：** 出血停止 → 裂口合拢 → 红细胞恢复平稳 → 下游重新变亮 → fibrin 动画安静下来

**美学方向：** abstract microscopic medical world。深色近黑红背景；血管半透明柔软有组织感。
**不是**医学教材、**不是**卡通儿童游戏、**不是** 3D 模拟器。

---

## 6. 已从原方案中删除（勿实现）

| 删除项 | 原因 |
|---|---|
| 环境音（心跳、血流声） | 浏览器 autoplay 策略会拦截（本游戏无 Start 按钮），且不能靠声音传规则。**只保留吸附时那一下短音**（由手势触发）。 |
| Phase A/B/C 三段脚本 | `flow = lumen²` 的非线性已自动产生「越接近堵塞越敏感」。只保留脉搏随时间增强这一条时间性曲线。 |
| `clotStability` 独立变量 | 已由纤溶（clot 自身衰减）承担。 |
| `flowRate` / `oxygen` 存进 state | 派生量存进 state 会导致不同步 bug。改为 selector。 |
| `occlusion` 独立变量 | 与 clot 合并。一个数同时封堵与阻塞，这就是设计命题。 |
| 复杂 fibrin 网格 / 血滴粒子系统 | 3–5 条半透明曲线随 clot 增长即可；血滴用几个下落的圆 + CSS 动画。 |
| 关卡系统、leaderboard、成就、道具 | Scope 禁令。 |

---

## 7. 技术与工程坑（必须写进 CLAUDE.md）

**技术栈：** Vite + TypeScript + SVG + CSS animations + Pointer Events + Vitest

| 坑 | 处理 |
|---|---|
| **Vite `base`** | Pages 部署在 `/<repo-name>/` 下，忘设 base = 白屏。**STEP 0 就把空白页部署上去验证。** |
| **`touch-action: none`** | 不加则手机上拖血小板变成滚动页面，移动端完全不可玩。 |
| **SVG 坐标转换** | 指针坐标须经 `getScreenCTM().inverse()` 转到 viewBox 空间，否则响应式缩放后吸附位置偏移。 |
| **`setPointerCapture`** | 拖出 SVG 边界时不丢失指针事件。 |
| **性能** | 不给逐帧移动的元素上 SVG filter/blur。血管用静态渐变，红细胞用纯色圆，glow 只给裂口。红细胞数量上限 ~40。 |
| **marking viewports** | 从课程网站抄下确切像素值写进 `CLAUDE.md`，不靠记忆。 |
| **游戏循环** | `requestAnimationFrame`，dt 上限 clamp 到 0.05s（切标签页回来不会瞬间死亡）。 |

**文件结构：**
```
src/rules.ts        纯规则，零 DOM        (~120 行)
src/rules.test.ts   focused test          (~40 行)
src/render.ts       SVG 渲染，只读 state  (~250 行)
src/drag.ts         指针与磁吸            (~100 行)
src/main.ts         游戏循环与装配        (~80 行)
index.html + style.css                    (~150 行)
scripts/check-no-instructions.mjs         (~30 行)
```
总量约 800 行 —— 一周作业的合理规模。

---

## 8. 自动化检查

### 8.1 核心规则测试（HD 关键）

**不要**只测阈值比较（`occlusion >= THRESHOLD → blocked` 是同义反复，marker 一眼看穿）。
**要测设计命题本身：**

```ts
it("a platelet reduces the leak and narrows the lumen at the same time", () => {
  const before = createInitialState();
  const after  = addPlatelet(before);
  expect(leak(after)).toBeLessThan(leak(before));
  expect(lumen(after)).toBeLessThan(lumen(before));
});
```

一个动作同时带来收益与风险 —— 这条测试锁住的是规则，不是常数。

**允许的第二、三条便宜测试：**
```ts
it("ends as bleeding when the wound is left untreated", () => {
  let s = createInitialState();
  for (let i = 0; i < 60 * 60; i++) s = updateGame(s, 1 / 60);
  expect(s.outcome).toBe("bleeding");
});

it("ends as blocked when too many platelets are placed", () => {
  let s = createInitialState();
  for (let i = 0; i < 12; i++) s = addPlatelet(s);
  expect(evaluateOutcome(s)).toBe("blocked");
});
```

不要为凑数量堆测试。

### 8.2 no-tutorial harness check（强烈建议，PROCESS.md 的最佳素材）

`scripts/check-no-instructions.mjs`：grep 构建产物（`dist/`）中的禁用词，命中即失败，接入 `pnpm check`。

```js
const BANNED = [
  /how to play/i, /instructions?/i, /tutorial/i, /drag the/i,
  /click to/i, /tap to/i, /press the/i, /tooltip/i, /guide/i,
];
```

> brief 说无教程「没法测也没法造假」。你确实测不出**它是否教会了人**，但你能测**它有没有偷偷变回有教程**。Claude 在 STEP 4 做 polish 时极大概率会自己加一个 tooltip 或在结束画面写一句解释 —— 那条 check 变红、你把它删掉的 commit，就是一次落在 **harness** 而非 retry 里的修正。PROCESS.md 明确说这才是拿分的地方。

---

## 9. 开发路线：STEP 0–5

**每一步的铁律（写进每个 prompt）：**
> 只做本步骤列出的文件，不要碰其他文件。完成后运行 `pnpm check`，把结果贴给我，**停下来等我确认，不要自动进入下一步**。

---

### STEP 0 — 地基与部署

**做：** 初始化 Vite + TS + Vitest；配置 `vite.config.ts` 的 `base: '/<repo-name>/'`；GitHub Actions 部署到 Pages；写 `CLAUDE.md`（含 §1 原则、§6 删除项、§7 坑清单、marking viewport 像素值）；写 `scripts/check-no-instructions.mjs` 并接入 `pnpm check`；部署一个空白页。

**验收：** public GitHub Pages URL 能打开（哪怕是黑屏）。`pnpm check` 全绿。

**Commit:** `set up harness and deploy pipeline`

---

### STEP 1 — 规则契约

**做：** `src/rules.ts`（§2 全部常量、类型、selector、`createInitialState` / `addPlatelet` / `updateGame` / `evaluateOutcome` / `flowScore`）+ `src/rules.test.ts`（§8.1 的三条测试）。

**禁止：** 任何 DOM、SVG、渲染代码。

**验收：** 三条测试全绿；`rules.ts` 中不出现 `document`、`window`、`SVG`。

**Commit:** `define clot-flow rules and focused test`

---

### STEP 2 — 静态世界与 affordance

**做：** 响应式 SVG 血管；红细胞流动；裂口 + 渗血；血小板随血流飘入/飘出；hover 反应；pointer 拖拽（含 `setPointerCapture`、`touch-action: none`、`getScreenCTM` 坐标转换）；大 hit area；§4.3 的 idle hint。

**暂不做：** 磁吸、放置、结局。血小板拖了就回到漂流状态。

**验收：** 在两个 marking viewport 打开，**找一个不知情的人，什么都不说，看他是否在 10 秒内主动去碰血小板。**

**Commit:** `build self-teaching vessel interaction`

---

### STEP 3 — 磁吸与核心循环

**做：** 三段式吸附（远/中/近）；release 后短距 glide 而非瞬移；放置 → `addPlatelet`；fibrin 线随 clot 增长；裂口随 woundSize 收窄；漏血随 leak 下降；红细胞速度/间距/排队随 flow 变化；下游组织亮度随 oxygen 变化；接上 `updateGame` 主循环（dt clamp 0.05）。

**验收：** 已经能完整地玩 —— 能封堵、能看见伤口合拢、能感觉到红细胞变慢。

**Commit:** `connect platelet placement to clot and flow`

---

### STEP 4 — 结局与预警

**做：** 三种结局的过渡动画（§5）；结局词 + `FLOW xx%` + `↻`；重开；吸附短音（Web Audio，首次手势时初始化 AudioContext）；两个 viewport 的响应式收尾。

**特别注意：** 这一步 Claude 最可能偷偷加 tooltip 或解释文字。跑 `pnpm check`，看 no-instructions check。

**验收：** 三种结局都能被实际玩到；`pnpm check` 全绿。

**Commit:** `add readable failure states and endings`

---

### STEP 5 — 试玩、修正、提交

**这一步不是写代码，是从「代码正确」进入「游戏成立」。**

1. 在两个 marking viewport 各完整玩若干局
2. **冷启动测试**：找人，什么都不说，看着他玩，全程闭嘴
3. **调磁吸**（最重要的一次 human-judgement 迭代）：吸附起始距离、三段强度、release glide 时长、hit area 半径
4. 调失败预警：BLOCKED 是否能提前察觉「我放多了」；BLEEDING 是否能察觉「我放得不够」。**不准改成文字警告**，只能加强 RBC 拥堵、血栓生长、下游变暗、血流减速
5. 检查一局能否在 5 分钟内结束
6. 删除任何解释性文字（含 README）
7. `pnpm check` 全绿
8. 写 `PROCESS.md`（见 §10）
9. 写 `reflections/crit-5.md`
10. 检查 commit history 是否体现渐进生长
11. 部署，**从 public URL 完整玩一遍**
12. 确认截止前 live

**Commit:** `tune interaction from playtesting and prepare crit-5`

---

## 10. PROCESS.md 素材（试玩驱动的修改）

**首选：magnetic snap tuning。** 四个要素齐全：

> **what happened** — 拖放功能在技术上完全正确，自动测试全绿，但真人试玩时把血小板放进伤口感觉笨重、需要过高的精度。
> **what I did instead** — 没有加「拖到这里」的提示，而是扩大了有效 hit 半径、在远距离加入柔性吸引、近距离用更强的 snap，并把最终吸附从瞬移改成短距 glide。
> **how I knew** — 在两个 marking viewport 各拖了几十次，并让一个不知情的人冷玩：修改前他前三次都没能放进去，修改后第一次就成功。
> **the citation** — commit hash / 对比截图。

> Automated tests could establish that placement changed the game state correctly, but they could not establish whether placement felt obvious or satisfying. Repeated play at both marking viewports showed that the original snap radius demanded too much precision, so I widened the attraction zone and changed the final attachment from an instant jump to a short glide.

**备选第二个 moment：no-instructions check 从红变绿**（修正落在 harness 而非 retry —— 这是 PROCESS.md 明说的高分模式）。

---

## 11. Definition of Done

- [ ] 已部署至 public GitHub Pages 并在截止前 live
- [ ] opening screen 无任何教程
- [ ] 陌生人 10 秒内发现第一次操作
- [ ] 玩家可以失败
- [ ] 三种结局都可达
- [ ] 一局可在 5 分钟内结束
- [ ] 单一 drag mechanic 足以完成整局
- [ ] BLEEDING 与 BLOCKED 都可提前预判
- [ ] 至少一条 focused、不依赖 DOM 的 game-rule test
- [ ] no-instructions check 接入 `pnpm check`
- [ ] 至少一次修改来自真人试玩
- [ ] 两个 marking viewport 均实际测试
- [ ] `PROCESS.md` 完成
- [ ] `reflections/crit-5.md` 完成
- [ ] commit history 体现游戏逐步生长
- [ ] README 不承担 tutorial
- [ ] 从 public URL 完整玩过一遍

---

## 12. Scope 禁令（Claude Code 不得擅自加入）

tutorial · help text · tooltip · instruction modal · 解剖学标签 · 3D · 物理引擎 · 流体模拟 · 完整凝血级联 · 多关卡 · inventory · health bar · skill tree · 敌人 · power-up · leaderboard · 过量粒子特效 · 复杂菜单 · 后端 · 数据库

**一个动作。两个相反风险。三种结局。一分钟形成完整体验。五分钟产生 mastery。**
