/*
 * 推理强度快调 (Reasoning Quick Switch) v1.3.0
 * 面向 TauriTavern / SillyTavern 的第三方扩展。
 *
 * v1.3.0 变更（外观重做）:
 * - 输入框上方档位条改为「分段控件」：一条浅灰底板 + 四格等分，靠右放置
 * - 去掉 🧠 图标与每格的独立边框，高度 36px → 30px
 * - 点档位不再弹 toast，直接静默生效（高亮就是反馈）
 * - 当前接口不支持推理强度时，整条降到 35% 透明度并禁用点击
 *
 * v1.2.0 保留:
 * - 输入框上方常驻「档位条」: 低 | 高 | 极高 | 最高 四芯片
 *   · 单击芯片直接切档(无循环)
 *   · 当前档位高亮;当前档不在四芯片内时动态补显
 * - 档位条随窗口重渲染自动挂回
 *
 * v1.1.0 保留:
 * - 启动时自动把推理强度设为「高」(覆盖预设自带的 low)
 * - 切换模型 / API 来源 / 预设时自动恢复「高」
 * - 魔棒菜单芯片照常可用
 */
(function () {
    'use strict';

    const EXT_ID = 'reasoning_quick_menu';   // 魔棒菜单条目
    const BAR_ID = 'rqs_bar';                // 输入框上方档位条
    const DEFAULT_LEVEL = 'high';

    const LEVELS = [
        { v: 'auto',   label: '自动' },
        { v: 'min',    label: '极低' },
        { v: 'low',    label: '低' },
        { v: 'medium', label: '中' },
        { v: 'high',   label: '高' },
        { v: 'xhigh',  label: '极高' },
        { v: 'max',    label: '最高' },
    ];

    /** 档位条上常驻显示的芯片(按用户要求:低/高/极高/最高) */
    const BAR_LEVELS = ['low', 'high', 'xhigh', 'max'];

    function getSelect() {
        return document.getElementById('openai_reasoning_effort');
    }

    /** 宿主是否真的提供了推理强度选项（原生补全类接口没有这个控件） */
    function isSupported() {
        const sel = getSelect();
        return !!(sel && sel.options && sel.options.length > 0);
    }

    function labelOf(v) {
        const hit = LEVELS.find(x => x.v === v);
        return hit ? hit.label : v;
    }

    function toast(msg, type) {
        try {
            if (window.toastr) { window.toastr[type || 'info'](msg); }
            else { console.log('[推理强度快调]', msg); }
        } catch (_) { console.log('[推理强度快调]', msg); }
    }

    /* ---------- 状态同步:魔棒芯片 + 档位条 一起刷新 ---------- */

    function updateChips() {
        const sel = getSelect();
        const cur = sel ? sel.value : '';

        // 魔棒菜单芯片
        document.querySelectorAll('#' + EXT_ID + ' .rqs-chip').forEach(chip => {
            chip.classList.toggle('rqs-active', chip.dataset.v === cur);
        });
        const wandLabel = document.getElementById('rqs_current');
        if (wandLabel) {
            wandLabel.textContent = cur ? ('推理强度：' + labelOf(cur)) : '推理强度（当前接口未开放）';
        }

        // 输入框上方档位条
        updateBar(cur);
    }

    function updateBar(cur) {
        const bar = document.getElementById(BAR_ID);
        if (!bar) { return; }

        // 接口不支持时整条置灰禁用
        bar.classList.toggle('rqs-off', !isSupported());

        // 常驻四芯片高亮
        bar.querySelectorAll('.rqs-bchip[data-v]').forEach(chip => {
            chip.classList.toggle('rqs-active', chip.dataset.v === cur);
        });

        // 动态补显:当前档不在常驻芯片里时,临时挂一个芯片
        const seg = bar.querySelector('.rqs-seg') || bar;
        const extra = document.getElementById('rqs_bchip_extra');
        if (cur && !BAR_LEVELS.includes(cur)) {
            if (extra) {
                extra.dataset.v = cur;
                extra.textContent = labelOf(cur);
                extra.classList.add('rqs-active');
            } else {
                const chip = document.createElement('span');
                chip.id = 'rqs_bchip_extra';
                chip.className = 'rqs-bchip rqs-active';
                chip.dataset.v = cur;
                chip.textContent = labelOf(cur);
                chip.addEventListener('click', () => setLevel(cur, { silent: true }));
                seg.appendChild(chip);
            }
        } else if (extra) {
            extra.remove();
        }
    }

    /* ---------- 切档 ---------- */

    function setLevel(v, opts) {
        const sel = getSelect();
        if (!sel) { return false; }
        const exists = Array.from(sel.options).some(o => o.value === v);
        if (!exists) { return false; }
        const changed = sel.value !== v;
        sel.value = v;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        updateChips();
        if (!opts || !opts.silent) {
            toast(changed ? ('推理强度已切换：' + labelOf(v)) : ('推理强度当前就是：' + labelOf(v)), 'success');
        }
        return true;
    }

    /* ---------- 自动默认:启动/模型/预设变更时恢复「高」 ---------- */

    let autoApplying = false;

    function applyDefault(reason) {
        if (autoApplying) { return; }
        const sel = getSelect();
        if (!sel) { return; }
        if (sel.value === DEFAULT_LEVEL) { return; }
        autoApplying = true;
        try {
            setLevel(DEFAULT_LEVEL, { silent: true });
            toast('推理强度已自动设为：高（' + reason + '）', 'info');
        } finally {
            setTimeout(() => { autoApplying = false; }, 300);
        }
    }

    function modelSignature() {
        const parts = [];
        const src = document.getElementById('chat_completion_source');
        if (src) { parts.push(src.value); }
        const mainApi = document.getElementById('main_api');
        if (mainApi) { parts.push(mainApi.value); }
        const preset = document.getElementById('settings_preset_openai');
        if (preset) { parts.push(preset.value); }
        document.querySelectorAll('select[id^="model_"]').forEach(s => {
            parts.push(s.id + '=' + s.value);
        });
        return parts.join('|');
    }

    function startWatch() {
        let last = modelSignature();
        setInterval(() => {
            // 档位条被宿主重渲染冲掉时自动挂回
            const bar = document.getElementById(BAR_ID);
            if (!bar || !bar.isConnected) { buildBar(); }
            // 接口可切换（例如从补全接口切到 Chat Completion）时,置灰状态跟着刷新
            else { bar.classList.toggle('rqs-off', !isSupported()); }

            const cur = modelSignature();
            if (cur !== last) {
                last = cur;
                setTimeout(() => applyDefault('检测到模型/预设变更'), 600);
            }
        }, 2500);
    }

    /* ---------- 档位条(输入框上方) ---------- */

    function buildBar() {
        if (document.getElementById(BAR_ID)) { return; }

        const form = document.getElementById('send_form');
        const qrBar = document.getElementById('qr--bar');
        const bar = document.createElement('div');
        bar.id = BAR_ID;

        const seg = document.createElement('div');
        seg.className = 'rqs-seg';
        bar.appendChild(seg);

        for (const v of BAR_LEVELS) {
            const chip = document.createElement('span');
            chip.className = 'rqs-bchip';
            chip.dataset.v = v;
            chip.textContent = labelOf(v);
            chip.addEventListener('click', () => setLevel(v, { silent: true }));
            seg.appendChild(chip);
        }

        if (form && form.parentElement) {
            form.parentElement.insertBefore(bar, form);
        } else if (qrBar && qrBar.parentElement) {
            qrBar.parentElement.insertBefore(bar, qrBar);
        } else {
            document.body.appendChild(bar);
        }
        updateChips();
    }

    /* ---------- 魔棒菜单(保留) ---------- */

    function build(menu) {
        if (document.getElementById(EXT_ID)) { return; }

        const wrap = document.createElement('div');
        wrap.id = EXT_ID;
        wrap.className = 'list-group-item flexContainer';
        wrap.title = 'Reasoning Effort';

        const head = document.createElement('div');
        head.className = 'rqs-head';
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-brain';
        const label = document.createElement('span');
        label.id = 'rqs_current';
        label.textContent = '推理强度';
        head.appendChild(icon);
        head.appendChild(label);

        const chips = document.createElement('div');
        chips.className = 'rqs-chips';
        for (const lv of LEVELS) {
            const chip = document.createElement('span');
            chip.className = 'rqs-chip';
            chip.dataset.v = lv.v;
            chip.textContent = lv.label;
            chip.addEventListener('click', () => setLevel(lv.v));
            chips.appendChild(chip);
        }

        wrap.appendChild(head);
        wrap.appendChild(chips);
        menu.appendChild(wrap);

        updateChips();
        const sel = getSelect();
        if (sel) {
            sel.addEventListener('change', updateChips);
        }
    }

    function waitForMenu() {
        const started = Date.now();
        const timer = setInterval(() => {
            const menu = document.getElementById('extensionsMenu');
            if (menu) {
                clearInterval(timer);
                build(menu);
                buildBar();   // v1.3.0: 立即挂出档位条，不再等 2.5s 轮询
                setTimeout(() => applyDefault('启动'), 1500);
                startWatch();
                return;
            }
            if (Date.now() - started > 60000) {
                clearInterval(timer);
                console.warn('[推理强度快调] 等待魔棒菜单超时');
            }
        }, 400);
    }

    function waitForHost() {
        const ready = window.__TAURITAVERN__ && window.__TAURITAVERN__.ready;
        if (ready && typeof ready.then === 'function') {
            ready.then(waitForMenu).catch(() => waitForMenu());
            return;
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitForMenu);
        } else {
            waitForMenu();
        }
    }

    waitForHost();
})();
