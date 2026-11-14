/*
 * 推理强度快调 (Reasoning Quick Switch) v1.1.0
 * 面向 TauriTavern / SillyTavern 的第三方扩展。
 *
 * v1.1.0 新增:
 * - 启动时自动把推理强度设为「高」(覆盖预设里自带的 low)
 * - 切换模型 / API 来源 / 预设时,自动恢复「高」
 * - 魔棒菜单手动切换不受影响,聊的过程中手动改了就保持
 */
(function () {
    'use strict';

    const EXT_ID = 'reasoning_quick_menu';
    const DEFAULT_LEVEL = 'high';

    const LEVELS = [
        { v: 'auto',   label: '自动' },
        { v: 'min',    label: '极低' },
        { v: 'low',    label: '低' },
        { v: 'medium', label: '中' },
        { v: 'high',   label: '高' },
        { v: 'xhigh',  label: '超高' },
        { v: 'max',    label: '最高' },
    ];

    function getSelect() {
        return document.getElementById('openai_reasoning_effort');
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

    function updateChips() {
        const sel = getSelect();
        const cur = sel ? sel.value : '';
        document.querySelectorAll('#' + EXT_ID + ' .rqs-chip').forEach(chip => {
            chip.classList.toggle('rqs-active', chip.dataset.v === cur);
        });
        const label = document.getElementById('rqs_current');
        if (label) {
            label.textContent = cur ? ('推理强度：' + labelOf(cur)) : '推理强度（当前接口未开放）';
        }
    }

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

    /* ---- 自动默认:启动/模型/预设变更时恢复「高」 ---- */

    let autoApplying = false;

    function applyDefault(reason) {
        if (autoApplying) { return; }
        const sel = getSelect();
        if (!sel) { return; }
        if (sel.value === DEFAULT_LEVEL) { return; }  // 已是高,不折腾
        autoApplying = true;
        try {
            setLevel(DEFAULT_LEVEL, { silent: true });
            toast('推理强度已自动设为：高（' + reason + '）', 'info');
        } finally {
            setTimeout(() => { autoApplying = false; }, 300);
        }
    }

    /* 模型/API来源/预设 变化的特征签名 */
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

    function startModelWatch() {
        let last = modelSignature();
        setInterval(() => {
            const cur = modelSignature();
            if (cur !== last) {
                last = cur;
                // 稍等宿主把预设/模型带出来的推理强度落盘,再拉回默认
                setTimeout(() => applyDefault('检测到模型/预设变更'), 600);
            }
        }, 2500);
    }

    /* ---- 魔棒菜单 UI ---- */

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
        toast('推理强度快调 v1.1.0 已就绪');
    }

    function waitForMenu() {
        const started = Date.now();
        const timer = setInterval(() => {
            const menu = document.getElementById('extensionsMenu');
            if (menu) {
                clearInterval(timer);
                build(menu);
                // 启动默认:等宿主加载完预设/模型后再拉回「高」
                setTimeout(() => applyDefault('启动'), 1500);
                startModelWatch();
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
