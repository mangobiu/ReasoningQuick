/*
 * 推理强度快调 (Reasoning Effort Quick Switch)
 * 面向 TauriTavern / SillyTavern 的第三方扩展。
 * 在左下角魔棒菜单中加入一排档位按钮，点击即修改
 * 「AI 响应配置 → 推理强度」(#openai_reasoning_effort)，
 * 并派发原生 change 事件，由宿主自行保存设置。
 */
(function () {
    'use strict';

    const EXT_ID = 'reasoning_quick_menu';

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

    function setLevel(v) {
        const sel = getSelect();
        if (!sel) {
            toast('未找到推理强度控件，当前 API 可能不支持', 'warning');
            return;
        }
        const exists = Array.from(sel.options).some(o => o.value === v);
        if (!exists) {
            toast('当前模型/接口没有「' + labelOf(v) + '」这一档', 'warning');
            return;
        }
        sel.value = v;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        updateChips();
        toast('推理强度已切换：' + labelOf(v), 'success');
    }

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
        toast('推理强度快调已就绪（魔棒菜单）');
    }

    function waitForMenu() {
        const started = Date.now();
        const timer = setInterval(() => {
            const menu = document.getElementById('extensionsMenu');
            if (menu) {
                clearInterval(timer);
                build(menu);
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
