// settings.js
import { extension_settings } from "./index.js";
import * as Constants from './constants.js';
import { sharedState } from './state.js';
import { fetchQuickReplies } from './api.js';
// import { updateMenuVisibilityUI } from './ui.js'; // 不再需要

/**
 * 动态注入自动伸缩的CSS样式。
 */
function injectAutoShrinkStyle() {
    // 防止重复注入
    if (document.getElementById(Constants.ID_AUTO_SHRINK_STYLE_TAG)) {
        return;
    }

    const style = document.createElement('style');
    style.id = Constants.ID_AUTO_SHRINK_STYLE_TAG;
    // 优化后的CSS：使用SillyTavern的CSS变量并添加过渡效果
    style.innerHTML = `
        #qr--bar {
            height: 0px;
            overflow: hidden; /* 必须加，否则内容会溢出 */
            transition: height 0.3s ease-in-out;
        }
        #send_form:hover #qr--bar {
            /* 使用SillyTavern的变量来确保高度一致，比 'auto' 更平滑 */
            height: var(--buttons-bar-height); 
        }
    `;
    document.head.appendChild(style);
    console.log(`[${Constants.EXTENSION_NAME}] 自动伸缩功能已开启，样式已注入。`);
}

/**
 * 移除自动伸缩的CSS样式。
 */
function removeAutoShrinkStyle() {
    const style = document.getElementById(Constants.ID_AUTO_SHRINK_STYLE_TAG);
    if (style) {
        style.remove();
        console.log(`[${Constants.EXTENSION_NAME}] 自动伸缩功能已关闭，样式已移除。`);
    }
}


/**
 * 更新按钮图标显示 (核心逻辑)
 * 根据设置使用不同的图标、大小和颜色风格
 */
export function updateIconDisplay() {
    const button = sharedState.domElements.rocketButton;
    if (!button) return;

    const settings = extension_settings[Constants.EXTENSION_NAME];
    const iconType = settings.iconType || Constants.ICON_TYPES.ROCKET;
    const customIconUrl = settings.customIconUrl || '';
    const customIconSizeSetting = settings.customIconSize || Constants.DEFAULT_CUSTOM_ICON_SIZE; // 自定义图标大小
    const globalIconSizeSetting = settings.globalIconSize; // 全局图标大小 (可能为 null)
    const faIconCode = settings.faIconCode || '';

    // 1. 清除按钮现有内容和样式
    button.innerHTML = '';
    button.classList.remove('primary-button', 'secondary-button');
    button.style.backgroundImage = '';
    button.style.backgroundSize = '';
    button.style.backgroundPosition = '';
    button.style.backgroundRepeat = '';
    button.style.fontSize = ''; // 清除可能存在的字体大小
    button.classList.add('interactable');

    let iconAppliedSize = null; // 用于跟踪实际应用的像素大小或 null

    // 2. 根据图标类型设置内容和大小
    if (iconType === Constants.ICON_TYPES.CUSTOM && customIconUrl) {
        iconAppliedSize = `${customIconSizeSetting}px`;
        const customContent = customIconUrl.trim();
        const sizeStyle = `${iconAppliedSize} ${iconAppliedSize}`;
        // ... (SVG/图片/Base64 背景图逻辑保持不变，使用 sizeStyle) ...
        if (customContent.startsWith('<svg') && customContent.includes('</svg>')) {
            const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(customContent);
            button.style.backgroundImage = `url('${svgDataUrl}')`;
            button.style.backgroundSize = sizeStyle;
            button.style.backgroundPosition = 'center';
            button.style.backgroundRepeat = 'no-repeat';
        }
        else if (customContent.startsWith('data:') || customContent.startsWith('http') || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(customContent)) {
            button.style.backgroundImage = `url('${customContent}')`;
            button.style.backgroundSize = sizeStyle;
            button.style.backgroundPosition = 'center';
            button.style.backgroundRepeat = 'no-repeat';
        }
        else if (customContent.includes('base64,')) {
            let imgUrl = customContent;
            if (!customContent.startsWith('data:')) {
                const possibleType = customContent.substring(0, 10).includes('PNG') ? 'image/png' : 'image/jpeg';
                imgUrl = `data:${possibleType};base64,` + customContent.split('base64,')[1];
            }
            button.style.backgroundImage = `url('${imgUrl}')`;
            button.style.backgroundSize = sizeStyle;
            button.style.backgroundPosition = 'center';
            button.style.backgroundRepeat = 'no-repeat';
        } else {
            button.textContent = '?'; // 无法识别的格式
            console.warn(`[${Constants.EXTENSION_NAME}] 无法识别的自定义图标格式`);
        }
    } else { // 默认图标或 Font Awesome
        let useGlobalSize = globalIconSizeSetting && !isNaN(parseFloat(globalIconSizeSetting)) && parseFloat(globalIconSizeSetting) > 0;

        if (iconType === Constants.ICON_TYPES.FONTAWESOME && faIconCode) {
            button.innerHTML = faIconCode.trim();
            if (useGlobalSize) {
                iconAppliedSize = `${parseFloat(globalIconSizeSetting)}px`;
                // 优先将大小应用到图标元素本身
                const iconEl = button.firstElementChild;
                if (iconEl) {
                    iconEl.style.fontSize = iconAppliedSize;
                } else {
                    button.style.fontSize = iconAppliedSize;
                }
            }
        } else { // 预设的 FontAwesome 图标
            const iconClass = Constants.ICON_CLASS_MAP[iconType] || Constants.ICON_CLASS_MAP[Constants.ICON_TYPES.ROCKET];
            if (iconClass) {
                button.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
                if (useGlobalSize) {
                    iconAppliedSize = `${parseFloat(globalIconSizeSetting)}px`;
                    const iconEl = button.querySelector('i');
                    if (iconEl) {
                        iconEl.style.fontSize = iconAppliedSize;
                    } else {
                        button.style.fontSize = iconAppliedSize;
                    }
                }
            } else {
                button.innerHTML = `<i class="fa-solid ${Constants.ICON_CLASS_MAP[Constants.ICON_TYPES.ROCKET]}"></i>`;
                if (useGlobalSize) {
                    iconAppliedSize = `${parseFloat(globalIconSizeSetting)}px`;
                    const iconEl = button.querySelector('i');
                    if (iconEl) {
                        iconEl.style.fontSize = iconAppliedSize;
                    } else {
                        button.style.fontSize = iconAppliedSize;
                    }
                }
            }
        }
        // 确保非自定义图标继承发送按钮的颜色风格
        if (iconType !== Constants.ICON_TYPES.CUSTOM) {
            const iconEl = button.querySelector('i') || button.firstElementChild;
            if (iconEl) {
                iconEl.style.color = 'inherit';
            }
        }
    }

    // 3. 应用颜色匹配设置（通过添加类） - 这部分逻辑总是执行
    const sendButton = document.getElementById('send_but');
    let buttonClassToAdd = 'secondary-button';
    if (sendButton) {
        if (sendButton.classList.contains('primary-button')) {
            buttonClassToAdd = 'primary-button';
        }
    }
    button.classList.add(buttonClassToAdd);
    button.style.color = ''; // 清除内联颜色，让CSS类生效

    // 如果没有应用特定的大小 (iconAppliedSize is null)，
    // 并且不是自定义图标类型，则其大小会自然地跟随 primary/secondary button的风格。
    // 如果应用了特定大小 (iconAppliedSize is not null)，则该大小优先。
    // 对于背景图类型的自定义图标，大小是通过 background-size 设置的。
    // 对于字体图标（FA或预设），大小是通过 font-size 设置的。
}


/**
 * Creates the HTML for the settings panel.
 * @returns {string} HTML string for the settings.
 */
export function createSettingsHtml() {
    // 菜单样式设置面板
    const stylePanel = `
    <div id="${Constants.ID_MENU_STYLE_PANEL}">
        <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
            <h3>菜单样式设置</h3>
            <button class="menu_button" id="${Constants.ID_MENU_STYLE_PANEL}-close" style="width:auto; padding:0 10px;">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        
        <div class="quick-reply-style-group">
            <h4>菜单项样式</h4>
            <div class="quick-reply-settings-row">
                <label>菜单项背景:</label>
                <div class="color-picker-container">
                    <input type="color" id="qr-item-bgcolor-picker" class="qr-color-picker">
                    <input type="text" id="qr-item-bgcolor-text" class="qr-color-text-input" placeholder="#RRGGBB">
                </div>
                <div class="slider-container">
                    <input type="range" id="qr-item-opacity" min="0" max="1" step="0.1" value="0.7" class="qr-opacity-slider">
                    <span id="qr-item-opacity-value" class="opacity-value">0.7</span>
                </div>
            </div>
            <div class="quick-reply-settings-row">
                <label>菜单项文字:</label>
                <div class="color-picker-container">
                    <input type="color" id="qr-item-color-picker" class="qr-color-picker">
                    <input type="text" id="qr-item-color-text" class="qr-color-text-input" placeholder="#RRGGBB">
                </div>
            </div>
        </div>
        
        <div class="quick-reply-style-group">
            <h4>标题样式</h4>
            <div class="quick-reply-settings-row">
                <label>标题文字:</label>
                <div class="color-picker-container">
                    <input type="color" id="qr-title-color-picker" class="qr-color-picker">
                    <input type="text" id="qr-title-color-text" class="qr-color-text-input" placeholder="#RRGGBB">
                </div>
            </div>
            <div class="quick-reply-settings-row">
                <label>分割线:</label>
                <div class="color-picker-container">
                    <input type="color" id="qr-title-border-picker" class="qr-color-picker">
                    <input type="text" id="qr-title-border-text" class="qr-color-text-input" placeholder="#RRGGBB">
                </div>
            </div>
        </div>
        
        <div class="quick-reply-style-group">
            <h4>空提示样式</h4>
            <div class="quick-reply-settings-row">
                <label>提示文字:</label>
                <div class="color-picker-container">
                    <input type="color" id="qr-empty-color-picker" class="qr-color-picker">
                    <input type="text" id="qr-empty-color-text" class="qr-color-text-input" placeholder="#RRGGBB">
                </div>
            </div>
        </div>
        
        <div class="quick-reply-style-group">
            <h4>菜单面板样式</h4>
            <div class="quick-reply-settings-row">
                <label>菜单背景:</label>
                <div class="color-picker-container">
                    <input type="color" id="qr-menu-bgcolor-picker" class="qr-color-picker">
                    <input type="text" id="qr-menu-bgcolor-text" class="qr-color-text-input" placeholder="#RRGGBB">
                </div>
                <div class="slider-container">
                    <input type="range" id="qr-menu-opacity" min="0" max="1" step="0.1" value="0.85" class="qr-opacity-slider">
                    <span id="qr-menu-opacity-value" class="opacity-value">0.85</span>
                </div>
            </div>
            <div class="quick-reply-settings-row">
                <label>菜单边框:</label>
                <div class="color-picker-container">
                    <input type="color" id="qr-menu-border-picker" class="qr-color-picker">
                    <input type="text" id="qr-menu-border-text" class="qr-color-text-input" placeholder="#RRGGBB">
                </div>
            </div>
        </div>
        
        <div style="display:flex; justify-content:space-between; margin-top:20px;">
            <button class="menu_button" id="${Constants.ID_RESET_STYLE_BUTTON}" style="width:auto; padding:0 10px;">
                <i class="fa-solid fa-rotate-left"></i> 恢复默认
            </button>
            <button class="menu_button" id="${Constants.ID_MENU_STYLE_PANEL}-apply" style="width:auto; padding:0 10px;">
                <i class="fa-solid fa-check"></i> 应用样式
            </button>
        </div>
    </div>
    `;

    // 使用说明面板 (需要更新内容)
    const usagePanel = `
    <div id="${Constants.ID_USAGE_PANEL}" class="qr-usage-panel">
        <div style="margin-bottom:7px;">
            <h3 style="color: white; font-weight: bold; margin: 0 0 7px 0;">使用说明</h3>
        </div>

        <div class="quick-reply-usage-content">
            <p><strong>该插件主要提供以下基本功能：</strong></p>
            <ul>
                <li>通过点击发送按钮旁边的小图标，快速打开或关闭快速回复菜单。</li>
                <li>支持两种快速回复类型："聊天快速回复"（针对当前聊天）和"全局快速回复"（适用于所有聊天），方便分类管理。而前端助手制作的QR会被合并到聊天快速回复中。</li>
            </ul>

            <p><strong>以下是关于插件的详细设置</strong></p>

            <p><strong>首先，在基本设置中，你可以：</strong></p>
            <ul>
                <li>选择"启用"或"禁用"来控制插件的整体开关状态。</li>
                <li>选择显示在发送按钮旁边的图标样式，可选项包括：
                    <ul>
                        <li>小火箭（默认）</li>
                        <li>调色盘</li>
                        <li>星月</li>
                        <li>五芒星</li>
                        <li>Font Awesome（使用HTML代码复制）</li> 
                        <li>自定义图标（catbox的URL链接/SVG代码/上传的图片，图片形状可自行裁剪）</li> 
                    </ul>
                </li>
            </ul>

            <p><strong>其次，在图标设置部分：</strong></p>
            <ul>
                <li>若选择"自定义图标"：
                    <ul>
                        <li>可以通过输入图标的URL、base64编码或SVG代码来设置。</li>
                        <li>也可以点击"选择文件"上传本地图片。</li>
                        <li>旁边有一个数字输入框，可以调整图标在按钮上显示的大小（单位：像素）。</li>
                    </ul>
                </li>
                <li>若选择"Font Awesome"：
                    <ul>
                        <li>需要在一个文本框中输入完整的 Font Awesome 图标 HTML 代码（fontawesome.com），例如 <code><i class="fa-solid fa-camera"></i></code>。</li>
                        <li>图标的大小和颜色将尽量匹配按钮的样式。</li>
                        <li>该颜色匹配设置始终启用，无需额外勾选。</li>
                    </ul>
                </li>
            </ul>

<p><strong>然后，你可以通过点击"菜单样式"按钮，来自定义快速回复菜单的外观：</strong></p>
            <ul>
                <li><strong>菜单项样式：</strong>
                    <ul>
                        <li>设置菜单项的背景颜色和透明度（通过滑动条调节）。</li>
                        <li>设置菜单项的文字颜色。</li>
                    </ul>
                </li>
                <li><strong>标题样式：</strong>
                    <ul>
                        <li>设置标题文字的颜色。</li>
                        <li>设置分割线的颜色。</li>
                    </ul>
                </li>
                <li><strong>其他样式设置：</strong>
                    <ul>
                        <li>设置无快速回复项时提示文字的颜色。</li>
                        <li>设置整个菜单面板的背景颜色、透明度和边框颜色。</li>
                    </ul>
                </li>
            </ul>
        
            <p><strong>调整样式后，有两个控制按钮可供使用：</strong></p>
            <ul>
                <li>恢复默认：将所有样式设置还原为初始状态。</li>
                <li>应用样式：保存并应用当前的样式修改。</li>
            </ul>
        
            <p><strong>这里有一些使用这款插件的小技巧：</strong></p>
            <ul>
                <li>可以点击QR助手的快速回复菜单的外部的任意区域直接关闭菜单。</li>
                <li>你可以通过更改图标类型和颜色，使其更好地匹配你的界面主题。</li>
                <li>可以直接上传图片、svg图标以及挂在图床上的链接作为按钮。</li>
            </ul>

            <p><strong>最后是关于数据保存：</strong></p>
            <p>完成所有配置（包括图标和样式设置）后，记得点击"保存设置"按钮来手动保存，以确保你的设置不会丢失。Font Awesome 图标（酒馆就是使用的这家免费图标）可以在官网 (fontawesome.com) 查找。</p>
            <p>有任何BUG、疑问或建议都欢迎反馈！</p>
        </div>

        <div style="text-align:center; margin-top:10px;">
            <button class="menu_button" id="${Constants.ID_USAGE_PANEL}-close" style="width:auto; padding:0 10px;">
                确定
            </button>
        </div>
    </div>
    `;

    // --- 更改开始：修改白名单面板的 HTML，移除中间的箭头按钮 ---
    const whitelistPanel = `
    <div id="${Constants.ID_WHITELIST_PANEL}" class="qr-whitelist-panel">
        <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
            <h3>白名单管理</h3>
            <button class="menu_button" id="${Constants.ID_WHITELIST_PANEL}-close" style="width:auto; padding:0 10px;">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <p style="font-size:small; margin-bottom:10px;">
            点击项目可将其在两个列表间移动。移至右侧"白名单"可使其在原生界面显示。
        </p>
        <div style="display:flex; justify-content:space-between; gap:10px;">
            <div style="width:48%;">
                <label for="qrq-non-whitelisted-list">在 QRQ 菜单中 (点击添加到白名单):</label>
                <select id="qrq-non-whitelisted-list" multiple style="width:100%; height:150px; cursor: pointer;"></select>
            </div>
            <div style="width:48%;">
                <label for="qrq-whitelisted-list">已在白名单中 (点击移出白名单):</label>
                <select id="qrq-whitelisted-list" multiple style="width:100%; height:150px; cursor: pointer;"></select>
            </div>
        </div>
        <div id="qrq-whitelist-save-status" style="text-align:center; color:#4caf50; height:20px; margin-top:5px;"></div>
    </div>
    `;
    // --- 更改结束 ---

    // 在自定义图标的容器里添加保存按钮和选择下拉菜单以及删除按钮
    const customIconContainer = `
        <div class="custom-icon-container" style="
            display: grid;
            grid-template-columns: auto auto auto;
            grid-auto-rows: auto;
            column-gap: 10px;
            row-gap: 12px;
            align-items: center;
        ">
            <!-- 第一行：URL 左对齐，上传按钮 右对齐 -->
            <label style="grid-column: 1; justify-self: start;">自定义图标URL:</label>
            <input type="text" id="${Constants.ID_CUSTOM_ICON_URL}"
                   style="grid-column: 2; width:auto; justify-self: start;"
                   placeholder="输入URL或上传图片">
            <button for="icon-file-upload" class="menu_button"
                    style="grid-column: 3; justify-self: end; width:auto;">
                <i class="fa-solid fa-upload"></i> 上传图片
            </button>
            <input type="file" id="icon-file-upload" accept="image/*" style="display:none;" />

            <!-- 第二行：图标大小 输入长度增至原来的1.5倍 -->
            <label style="grid-column: 1; justify-self: start;">图标大小 (px):</label>
            <input type="number" id="${Constants.ID_CUSTOM_ICON_SIZE_INPUT}" min="16" max="40"
                   style="grid-column: 2; width:auto; transform: scaleX(0.75); transform-origin: left center; justify-self: start;"/>

            <!-- 第三行：保存图标 按钮左对齐 -->
            <button id="${Constants.ID_CUSTOM_ICON_SAVE}" class="menu_button"
                    style="grid-column: 1; justify-self: start; width:auto;">
                <i class="fa-solid fa-save"></i> 保存图标
            </button>

            <!-- 第三行：选择已保存图标 下拉框长度降为原来的0.8倍 -->
            <select id="${Constants.ID_CUSTOM_ICON_SELECT}" class="transparent-select"
                    style="grid-column: 2; justify-self: center; width: 80%;">
                <option value="">-- 选择已保存图标 --</option>
            </select>

            <!-- 第四行：删除图标按钮右对齐 -->
            <button id="${Constants.ID_DELETE_SAVED_ICON_BUTTON}" class="menu_button"
                    style="grid-column: 3; justify-self: end; width:auto;">
                <i class="fa-solid fa-trash-can"></i> 删除图标
            </button>
        </div>
    `;

    return `
    <div id="${Constants.ID_SETTINGS_CONTAINER}" class="extension-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>QR助手</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="flex-container flexGap5">
                    <select id="${Constants.ID_SETTINGS_ENABLED_DROPDOWN}" class="text_pole">
                        <option value="true">启用</option>
                        <option value="false">禁用</option>
                    </select>
                </div>

                <hr class="sysHR">
                <div class="flex-container flexGap5">
                    <label for="${Constants.ID_ICON_TYPE_DROPDOWN}">图标类型:</label>
                    <select id="${Constants.ID_ICON_TYPE_DROPDOWN}" class="text_pole transparent-select" style="width:120px;">
                        <option value="${Constants.ICON_TYPES.ROCKET}">小火箭</option>
                        <option value="${Constants.ICON_TYPES.COMMENT}">调色盘</option>
                        <option value="${Constants.ICON_TYPES.STAR}">星月</option>
                        <option value="${Constants.ICON_TYPES.BOLT}">五芒星</option>
                        <option value="${Constants.ICON_TYPES.FONTAWESOME}">Font Awesome</option> 
                        <option value="${Constants.ICON_TYPES.CUSTOM}">自定义图标</option>
                    </select>
                </div>

                <div class="flex-container flexGap5 global-icon-container" style="margin-top:10px;">
                    <label for="${Constants.ID_GLOBAL_ICON_SIZE_INPUT}">图标大小 (默认/FA):</label>
                    <input type="number" id="${Constants.ID_GLOBAL_ICON_SIZE_INPUT}" min="10" max="40"
                           style="width: auto;
                                  height: var(--buttons-bar-height);
                                  min-width: 2.5em;
                                  margin-right: 10px;"
                           placeholder="默认">
                    <button id="${Constants.ID_RESET_ICON_SIZE_BUTTON}" class="menu_button"
                            style="width: auto;
                                     padding: 0 5px;
                                     margin-left: auto;"
                            title="恢复为匹配发送按钮的默认大小和颜色风格">
                        <i class="fa-solid fa-arrow-rotate-left"></i> 恢复默认大小
                    </button>
                </div>

                <div class="flex-container flexGap5 custom-icon-container" style="display: none; margin-top:10px; align-items: center;">
                    ${customIconContainer}
                </div>

                <div class="flex-container flexGap5 fa-icon-container" style="display: none; margin-top:10px;">
                    <label for="${Constants.ID_FA_ICON_CODE_INPUT}">FA 代码（fontawesome.com）:</label>
                    <input type="text" id="${Constants.ID_FA_ICON_CODE_INPUT}" class="text_pole" style="flex-grow:1;"
                           placeholder='粘贴 FontAwesome HTML, 如 <i class="fa-solid fa-house"></i>' />
                </div>

                <hr class="sysHR">
                <div class="flex-container flexGap5" style="align-items: center; justify-content: space-between; margin-bottom: 15px;">
                    <div class="flex-container flexGap5" style="align-items: center;">
                        <input type="checkbox" id="${Constants.ID_AUTO_SHRINK_CHECKBOX}" style="margin:0; height:auto;">
                        <label for="${Constants.ID_AUTO_SHRINK_CHECKBOX}" style="margin:0; text-align:left;">开启按钮自动伸缩</label>
                    </div>
                    <button id="${Constants.ID_WHITELIST_BUTTON}" class="menu_button" style="width:auto; padding:0 10px;">
                        <i class="fa-solid fa-list-check"></i> 白名单管理
                    </button>
                </div>

                <div style="display:flex; justify-content:space-between; margin-top:15px;">
                    <button id="${Constants.ID_MENU_STYLE_BUTTON}" class="menu_button" style="width:auto; padding:0 10px;">
                        <i class="fa-solid fa-palette"></i> 菜单样式
                    </button>
                    <button id="${Constants.ID_USAGE_BUTTON}" class="menu_button" style="width:auto; padding:0 10px;">
                        <i class="fa-solid fa-circle-info"></i> 使用说明
                    </button>
                    <button id="qr-save-settings" class="menu_button" style="width:auto; padding:0 10px;" onclick="window.quickReplyMenu.saveSettings()">
                        <i class="fa-solid fa-floppy-disk"></i> 保存设置
                    </button>
                </div>

                <hr class="sysHR">
                <div id="qr-save-status" style="text-align: center; color: #4caf50; height: 20px; margin-top: 5px;"></div>
            </div>
        </div>
    </div>${stylePanel}${usagePanel}${whitelistPanel}`;
}


/**
 * 处理使用说明按钮点击
 */
export function handleUsageButtonClick() {
     // 确保使用更新后的 usagePanel 内容
    let usagePanel = document.getElementById(Constants.ID_USAGE_PANEL);
    if (usagePanel) {
        // 显示面板
        usagePanel.style.display = 'block';
        // 计算并设置面板位置...
         const windowHeight = window.innerHeight;
         const panelHeight = usagePanel.offsetHeight;
         const topPosition = Math.max(50, (windowHeight - panelHeight) / 2); // 尝试垂直居中，最小top为50px
         usagePanel.style.top = `${topPosition}px`;
         usagePanel.style.transform = 'translateX(-50%)';
    } else {
         // 如果不存在，则在 createSettingsHtml 中已经包含了它
         // 这里理论上不应该执行，除非 createSettingsHtml 失败
         console.error("Usage panel not found in DOM after settings creation.");
    }
}

/**
 * 关闭使用说明面板
 */
export function closeUsagePanel() {
    const usagePanel = document.getElementById(Constants.ID_USAGE_PANEL);
    if (usagePanel) {
        usagePanel.style.display = 'none';
    }
}

// 打开白名单管理弹窗
export function handleWhitelistButtonClick() {
  const panel = document.getElementById(Constants.ID_WHITELIST_PANEL);
  if (!panel) return;
  panel.style.display = 'block';
  // 垂直居中
  const top = Math.max(50, (window.innerHeight - panel.offsetHeight) / 2);
  panel.style.top = `${top}px`;
  panel.style.transform = 'translateX(-50%)';
  populateWhitelistManagementUI();
}

// --- 更改开始：修改关闭函数，增加自动保存逻辑 ---
// 关闭白名单管理弹窗，并自动保存设置
export function closeWhitelistPanel() {
  const panel = document.getElementById(Constants.ID_WHITELIST_PANEL);
  if (panel && panel.style.display !== 'none') {
    console.log(`[${Constants.EXTENSION_NAME}] Closing whitelist panel and saving settings.`);
    saveSettings(); // 调用保存函数
    
    // 显示一个短暂的保存提示
    const status = document.getElementById('qrq-whitelist-save-status');
    if (status) {
        status.textContent = '设置已在关闭时自动保存。';
        status.style.color = '#4caf50';
        setTimeout(() => { if (status.textContent.includes('自动保存')) status.textContent = ''; }, 2000);
    }
    
    // 稍作延迟后关闭面板，让用户能看到提示
    setTimeout(() => {
        panel.style.display = 'none';
    }, 300);
  }
}
// --- 更改结束 ---


// 统一处理设置变更的函数
export function handleSettingsChange(event) {
    const settings = extension_settings[Constants.EXTENSION_NAME];
    const targetId = event.target.id;
    const targetElement = event.target; // 缓存目标元素

    // 处理不同控件的设置变更
    if (targetId === Constants.ID_SETTINGS_ENABLED_DROPDOWN) {
        const enabled = targetElement.value === 'true';
        settings.enabled = enabled;
        document.body.classList.remove('qra-enabled', 'qra-disabled');
        document.body.classList.add(enabled ? 'qra-enabled' : 'qra-disabled');
        const rocketButton = document.getElementById(Constants.ID_ROCKET_BUTTON);
        if (rocketButton) {
            rocketButton.style.display = enabled ? 'flex' : 'none';
        }
    }
    else if (targetId === Constants.ID_ICON_TYPE_DROPDOWN) {
        settings.iconType = targetElement.value;
        const customIconContainer = document.querySelector('.custom-icon-container');
        const faIconContainer = document.querySelector('.fa-icon-container');
        if (customIconContainer) {
            customIconContainer.style.display = (settings.iconType === Constants.ICON_TYPES.CUSTOM) ? 'flex' : 'none';
        }
        if (faIconContainer) {
            faIconContainer.style.display = (settings.iconType === Constants.ICON_TYPES.FONTAWESOME) ? 'flex' : 'none';
        }
        // 新增：自定义图标时隐藏全局大小行，其他类型显示
        const globalIconContainer = document.querySelector('.global-icon-container');
        if (globalIconContainer) {
            globalIconContainer.style.display = (settings.iconType === Constants.ICON_TYPES.CUSTOM) ? 'none' : 'flex';
        }
    }
    else if (targetId === Constants.ID_CUSTOM_ICON_URL) {
        let newUrlFromInput = targetElement.value;

        if (newUrlFromInput === "[图片数据已保存，但不在输入框显示以提高性能]") {
            // 如果输入框的值是占位符，这意味着实际的URL在 dataset.fullValue 中 (由 handleFileUpload 设置)。
            // 此时 settings.customIconUrl 应该已经被 handleFileUpload 更新为真实数据。
            // 我们不应使用占位符覆盖 settings.customIconUrl。
            // 如果 dataset.fullValue 存在，则 settings.customIconUrl 应该等于它。
            // 如果 dataset.fullValue 不存在（不应该发生此情况，除非逻辑错误），则保留 settings.customIconUrl。
            // 实际上，这里的 settings.customIconUrl 几乎不需要改变，因为它已被上游函数（如 handleFileUpload）正确设置。
        } else if (newUrlFromInput.length > 1000) {
            // 用户输入或粘贴了一个长URL
            settings.customIconUrl = newUrlFromInput;      // 1. 更新 settings (真实数据)
            targetElement.dataset.fullValue = newUrlFromInput; // 2. 更新 dataset (真实数据备份)
            targetElement.value = "[图片数据已保存，但不在输入框显示以提高性能]"; // 3. 更新输入框显示 (占位符)
        } else {
            // 用户输入了一个短URL，或者清空了输入框
            settings.customIconUrl = newUrlFromInput;      // 1. 更新 settings (真实数据)
            delete targetElement.dataset.fullValue;    // 2. 清除旧的 dataset (如果存在)
                                                        // targetElement.value 已经是 newUrlFromInput (短的或空的)
        }
    }
    else if (targetId === Constants.ID_CUSTOM_ICON_SIZE_INPUT) {
        settings.customIconSize = parseInt(targetElement.value, 10) || Constants.DEFAULT_CUSTOM_ICON_SIZE;
    }
    else if (targetId === Constants.ID_FA_ICON_CODE_INPUT) {
        settings.faIconCode = targetElement.value;
    }
    else if (targetId === Constants.ID_GLOBAL_ICON_SIZE_INPUT) {
        const sizeVal = targetElement.value.trim();
        if (sizeVal === "" || isNaN(parseFloat(sizeVal))) {
            settings.globalIconSize = null;
        } else {
            settings.globalIconSize = parseFloat(sizeVal);
        }
    }
    else if (targetId === Constants.ID_AUTO_SHRINK_CHECKBOX) {
        settings.autoShrinkEnabled = targetElement.checked;
        if (settings.autoShrinkEnabled) {
            injectAutoShrinkStyle();
        } else {
            removeAutoShrinkStyle();
        }
    }

    // 如果自定义图标URL或大小被手动修改，检查是否仍与已保存图标匹配
    if (targetId === Constants.ID_CUSTOM_ICON_URL || targetId === Constants.ID_CUSTOM_ICON_SIZE_INPUT) {
        const currentUrl = settings.customIconUrl; // 现在这里总是完整的真实URL
        const currentSize = settings.customIconSize;
        const isStillSaved = settings.savedCustomIcons && settings.savedCustomIcons.some(
            icon => icon.url === currentUrl && icon.size === currentSize
        );
        if (!isStillSaved) {
            sharedState.currentSelectedSavedIconId = null;
            const deleteBtn = document.getElementById(Constants.ID_DELETE_SAVED_ICON_BUTTON);
            if (deleteBtn) deleteBtn.style.display = 'none';
            const selectElement = document.getElementById(Constants.ID_CUSTOM_ICON_SELECT);
            if (selectElement) selectElement.value = "";
        }
    }

    updateIconDisplay(); // 每次设置变化后都更新火箭按钮图标显示
}

// 保存设置
export function saveSettings() {
    const settings = extension_settings[Constants.EXTENSION_NAME];

    const enabledDropdown = document.getElementById(Constants.ID_SETTINGS_ENABLED_DROPDOWN);
    const iconTypeDropdown = document.getElementById(Constants.ID_ICON_TYPE_DROPDOWN);
    const customIconUrlInput = document.getElementById(Constants.ID_CUSTOM_ICON_URL);
    const customIconSizeInput = document.getElementById(Constants.ID_CUSTOM_ICON_SIZE_INPUT);
    const faIconCodeInput = document.getElementById(Constants.ID_FA_ICON_CODE_INPUT);
    const globalIconSizeInput = document.getElementById(Constants.ID_GLOBAL_ICON_SIZE_INPUT);
    const autoShrinkCheckbox = document.getElementById(Constants.ID_AUTO_SHRINK_CHECKBOX);

    if (enabledDropdown) settings.enabled = enabledDropdown.value === 'true';
    if (iconTypeDropdown) settings.iconType = iconTypeDropdown.value;

    // customIconUrl 已经被 handleSettingsChange 或 handleFileUpload 正确更新到 settings.customIconUrl
    // 所以这里理论上不需要再次从 DOM 读取并判断。
    // 但为保险起见，如果直接调用 saveSettings 而没有经过事件，可以保留从 DOM 读取的逻辑，
    // 或者，更好地是确保 settings.customIconUrl 总是权威来源。
    // 当前的 handleSettingsChange 已经维护了 settings.customIconUrl 的正确性。
    // 所以，我们信任 settings.customIconUrl。
    // if (customIconUrlInput) {
    //     if (customIconUrlInput.dataset.fullValue &&
    //         customIconUrlInput.value === "[图片数据已保存，但不在输入框显示以提高性能]") {
    //         settings.customIconUrl = customIconUrlInput.dataset.fullValue;
    //     } else {
    //         settings.customIconUrl = customIconUrlInput.value;
    //     }
    // }
    // (上面的注释掉的逻辑是确保从DOM读取，但如果 handleSettingsChange 正常工作，则不需要)

    if (customIconSizeInput) settings.customIconSize = parseInt(customIconSizeInput.value, 10) || Constants.DEFAULT_CUSTOM_ICON_SIZE;
    if (faIconCodeInput) settings.faIconCode = faIconCodeInput.value;
    if (globalIconSizeInput) {
        const sizeVal = globalIconSizeInput.value.trim();
        if (sizeVal === "" || isNaN(parseFloat(sizeVal))) {
            settings.globalIconSize = null;
        } else {
            settings.globalIconSize = parseFloat(sizeVal);
        }
    }
    if (autoShrinkCheckbox) {
        settings.autoShrinkEnabled = autoShrinkCheckbox.checked;
    }

    updateIconDisplay(); // 确保图标基于最新的 settings 对象显示

    let saved = false;
    if (typeof context !== 'undefined' && context.saveExtensionSettings) {
        try {
            context.saveExtensionSettings();
            console.log(`[${Constants.EXTENSION_NAME}] 设置已通过 context.saveExtensionSettings() 保存`);
            saved = true;
        } catch (error) {
            console.error(`[${Constants.EXTENSION_NAME}] 通过 context.saveExtensionSettings() 保存设置失败:`, error);
        }
    }

    try {
        localStorage.setItem('QRA_settings', JSON.stringify(settings));
        console.log(`[${Constants.EXTENSION_NAME}] 设置已保存到 localStorage`);
        saved = true;
    } catch (e) {
        console.error(`[${Constants.EXTENSION_NAME}] 保存设置到 localStorage 失败:`, e);
    }

    return saved;
}

/**
 * 辅助函数，安全地添加事件监听器
 */
function safeAddListener(id, event, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener(event, handler);
    } else {
        console.warn(`[${Constants.EXTENSION_NAME} Settings] Element not found: #${id}. Cannot add listener.`);
    }
}

/**
 * 设置事件监听器 (文件上传等)
 */
export function setupSettingsEventListeners() {
    // 使用说明按钮监听器
    const usageButton = document.getElementById(Constants.ID_USAGE_BUTTON);
    usageButton?.addEventListener('click', handleUsageButtonClick);

    // 使用说明面板关闭按钮监听器 (确保在 usagePanel 创建后或一直存在时能找到)
    // 注意：关闭按钮现在是 usagePanel 的一部分，监听器应在其显示时确保已添加
    // handleUsageButtonClick 函数内部可以处理添加监听器，或者假设它已在 createSettingsHtml 中设置好
    const usageCloseButton = document.getElementById(`${Constants.ID_USAGE_PANEL}-close`);
     if (usageCloseButton) {
         usageCloseButton.addEventListener('click', closeUsagePanel);
     }


    // 文件上传监听器
    const fileUpload = document.getElementById('icon-file-upload');
    if (fileUpload) {
        fileUpload.addEventListener('change', handleFileUpload);
    } else {
        console.warn(`[${Constants.EXTENSION_NAME}] 文件上传输入框未找到 (#icon-file-upload)`);
    }

    // 上传按钮点击事件 - 如果使用了label+input方案，这部分可能不需要
    const uploadButton = document.getElementById('custom-icon-upload');
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            // 查找或创建文件输入框
            let fileInput = document.getElementById('icon-file-upload');
            if (!fileInput) {
                fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.id = 'icon-file-upload';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                document.body.appendChild(fileInput);
                fileInput.addEventListener('change', handleFileUpload);
            }
            fileInput.click(); // 触发文件选择对话框
        });
    }

    // 添加保存按钮监听器
    const saveButton = document.getElementById('qr-save-settings');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const success = saveSettings(); // 调用保存函数

            // 显示保存反馈
            const saveStatus = document.getElementById('qr-save-status');
            if (saveStatus) {
                if (success) {
                    saveStatus.textContent = '✓ 设置已保存';
                    saveStatus.style.color = '#4caf50';
                } else {
                    saveStatus.textContent = '✗ 保存失败';
                    saveStatus.style.color = '#f44336';
                }
                setTimeout(() => { saveStatus.textContent = ''; }, 2000);
            }

            // 更新按钮视觉反馈
             if (success) {
                const originalHTML = saveButton.innerHTML;
                const originalBg = saveButton.style.backgroundColor;
                saveButton.innerHTML = '<i class="fa-solid fa-check"></i> 已保存';
                saveButton.style.backgroundColor = '#4caf50'; // Green success
                setTimeout(() => {
                    saveButton.innerHTML = originalHTML;
                    saveButton.style.backgroundColor = originalBg;
                }, 2000);
             }
        });
    }

    safeAddListener(Constants.ID_CUSTOM_ICON_SAVE, 'click', saveCustomIcon);
    safeAddListener(Constants.ID_CUSTOM_ICON_SELECT, 'change', handleCustomIconSelect);
    safeAddListener(Constants.ID_RESET_ICON_SIZE_BUTTON, 'click', handleResetIconSize);
    safeAddListener(Constants.ID_DELETE_SAVED_ICON_BUTTON, 'click', handleDeleteSavedIcon);

    // 白名单管理弹窗按钮
    const wlBtn = document.getElementById(Constants.ID_WHITELIST_BUTTON);
    wlBtn?.addEventListener('click', handleWhitelistButtonClick);
    const wlClose = document.getElementById(`${Constants.ID_WHITELIST_PANEL}-close`);
    wlClose?.addEventListener('click', closeWhitelistPanel);
}

/**
 * 处理文件上传事件
 * @param {Event} event 文件上传事件
 */
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const customIconUrlInput = document.getElementById(Constants.ID_CUSTOM_ICON_URL);
        if (customIconUrlInput) {
            const fileData = e.target.result; // 完整的 Data URL
            const settings = extension_settings[Constants.EXTENSION_NAME];

            // 1. 首先更新 settings 对象中的真实数据
            settings.customIconUrl = fileData;

            // 2. 然后更新 DOM 元素 (dataset 和 value)
            if (fileData.length > 1000) {
                customIconUrlInput.dataset.fullValue = fileData;
                customIconUrlInput.value = "[图片数据已保存，但不在输入框显示以提高性能]"; // 这可能会触发 input 事件 -> handleSettingsChange
            } else {
                delete customIconUrlInput.dataset.fullValue; // 清除旧的 dataset (如果适用)
                customIconUrlInput.value = fileData;          // 这也可能触发 input 事件
            }

            // 3. 更新图标显示 (它会从 settings.customIconUrl 读取)
            updateIconDisplay();

            // 4. 如果需要，标记"未保存"状态或提示用户保存。
            // (handleSettingsChange 会被触发，但其逻辑已调整，不会错误覆盖 settings.customIconUrl)
            // 检查是否与已保存的图标匹配，并相应地更新选择下拉框和删除按钮状态
            const currentSize = settings.customIconSize;
            const isStillSaved = settings.savedCustomIcons && settings.savedCustomIcons.some(
                icon => icon.url === fileData && icon.size === currentSize
            );
            if (!isStillSaved) {
                sharedState.currentSelectedSavedIconId = null;
                const deleteBtn = document.getElementById(Constants.ID_DELETE_SAVED_ICON_BUTTON);
                if (deleteBtn) deleteBtn.style.display = 'none';
                const selectElement = document.getElementById(Constants.ID_CUSTOM_ICON_SELECT);
                if (selectElement) selectElement.value = "";
            } else {
                // 如果上传的图标恰好是已保存的某个，可以考虑自动选中它
                const savedMatch = settings.savedCustomIcons.find(icon => icon.url === fileData && icon.size === currentSize);
                if (savedMatch) {
                    sharedState.currentSelectedSavedIconId = savedMatch.id;
                    const deleteBtn = document.getElementById(Constants.ID_DELETE_SAVED_ICON_BUTTON);
                    if (deleteBtn) deleteBtn.style.display = 'inline-block';
                    const selectElement = document.getElementById(Constants.ID_CUSTOM_ICON_SELECT);
                    if (selectElement) selectElement.value = savedMatch.id;
                }
            }
        }
    };
    reader.onerror = function(error) {
        console.error(`[${Constants.EXTENSION_NAME}] 读取文件失败:`, error);
    };
    reader.readAsDataURL(file);
}

/**
 * Loads initial settings and applies them to the UI elements in the settings panel.
 */
export function loadAndApplySettings() {
    const settings = extension_settings[Constants.EXTENSION_NAME] = extension_settings[Constants.EXTENSION_NAME] || {};

    settings.enabled = settings.enabled !== false;
    settings.iconType = settings.iconType || Constants.ICON_TYPES.ROCKET;
    settings.customIconUrl = settings.customIconUrl || ''; // 这个是权威数据
    settings.customIconSize = settings.customIconSize || Constants.DEFAULT_CUSTOM_ICON_SIZE;
    settings.faIconCode = settings.faIconCode || '';
    settings.globalIconSize = typeof settings.globalIconSize !== 'undefined' ? settings.globalIconSize : null;
    settings.savedCustomIcons = Array.isArray(settings.savedCustomIcons) ? settings.savedCustomIcons : []; // 确保是数组
    settings.whitelist = Array.isArray(settings.whitelist) ? settings.whitelist : [];
    settings.autoShrinkEnabled = settings.autoShrinkEnabled === true; // 新增：确保是布尔值

    const enabledDropdown = document.getElementById(Constants.ID_SETTINGS_ENABLED_DROPDOWN);
    if (enabledDropdown) enabledDropdown.value = String(settings.enabled);

    const iconTypeDropdown = document.getElementById(Constants.ID_ICON_TYPE_DROPDOWN);
    if (iconTypeDropdown) iconTypeDropdown.value = settings.iconType;

    const customIconUrlInput = document.getElementById(Constants.ID_CUSTOM_ICON_URL);
    if (customIconUrlInput) {
        // 根据 settings.customIconUrl (权威数据) 来设置 input.value 和 input.dataset.fullValue
        if (settings.customIconUrl && settings.customIconUrl.length > 1000) {
            customIconUrlInput.dataset.fullValue = settings.customIconUrl;
            customIconUrlInput.value = "[图片数据已保存，但不在输入框显示以提高性能]";
        } else {
            customIconUrlInput.value = settings.customIconUrl;
            delete customIconUrlInput.dataset.fullValue;
        }
    }

    const customIconSizeInput = document.getElementById(Constants.ID_CUSTOM_ICON_SIZE_INPUT);
    if (customIconSizeInput) customIconSizeInput.value = settings.customIconSize;

    const faIconCodeInput = document.getElementById(Constants.ID_FA_ICON_CODE_INPUT);
    if (faIconCodeInput) faIconCodeInput.value = settings.faIconCode;

    const customIconContainer = document.querySelector('.custom-icon-container');
    const faIconContainer = document.querySelector('.fa-icon-container');
    if (customIconContainer) {
        customIconContainer.style.display = (settings.iconType === Constants.ICON_TYPES.CUSTOM) ? 'flex' : 'none';
    }
    if (faIconContainer) {
        faIconContainer.style.display = (settings.iconType === Constants.ICON_TYPES.FONTAWESOME) ? 'flex' : 'none';
    }

    // 新增：加载时同步隐藏/显示全局大小行
    const globalIconContainer = document.querySelector('.global-icon-container');
    if (globalIconContainer) {
        globalIconContainer.style.display = (settings.iconType === Constants.ICON_TYPES.CUSTOM) ? 'none' : 'flex';
    }

    setupSettingsEventListeners();
    if (!settings.enabled && sharedState.domElements.rocketButton) {
        sharedState.domElements.rocketButton.style.display = 'none';
    }

    updateIconDisplay();
    updateCustomIconSelect(); // 确保加载后下拉列表也更新

    const globalIconSizeInput = document.getElementById(Constants.ID_GLOBAL_ICON_SIZE_INPUT);
    if (globalIconSizeInput) {
        globalIconSizeInput.value = settings.globalIconSize !== null ? settings.globalIconSize : "";
    }

    // 更新删除按钮的初始状态，基于当前 customIconUrl 和 customIconSize 是否匹配某个已保存项
    const isCurrentIconSaved = settings.savedCustomIcons.some(
        icon => icon.url === settings.customIconUrl && icon.size === settings.customIconSize
    );
    const savedMatch = settings.savedCustomIcons.find(icon => icon.url === settings.customIconUrl && icon.size === settings.customIconSize);

    const deleteBtn = document.getElementById(Constants.ID_DELETE_SAVED_ICON_BUTTON);
    const selectElement = document.getElementById(Constants.ID_CUSTOM_ICON_SELECT);

    if (savedMatch) {
        sharedState.currentSelectedSavedIconId = savedMatch.id;
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        if (selectElement) selectElement.value = savedMatch.id;
    } else {
        sharedState.currentSelectedSavedIconId = null;
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (selectElement) selectElement.value = "";
    }

    populateWhitelistManagementUI();
    if (window.quickReplyMenu?.applyWhitelistDOMChanges) window.quickReplyMenu.applyWhitelistDOMChanges();
    
    // 加载并应用自动伸缩设置
    const autoShrinkCheckbox = document.getElementById(Constants.ID_AUTO_SHRINK_CHECKBOX);
    if (autoShrinkCheckbox) {
        autoShrinkCheckbox.checked = settings.autoShrinkEnabled;
    }
    // 根据加载的设置，决定是注入还是移除样式
    if (settings.autoShrinkEnabled) {
        injectAutoShrinkStyle();
    } else {
        // 这一步至关重要：确保在设置为false时，任何残留的样式都会被移除
        removeAutoShrinkStyle();
    }

    console.log(`[${Constants.EXTENSION_NAME}] Settings loaded and applied to settings panel.`);
}

/**
 * 保存当前自定义图标设置到列表
 */
function saveCustomIcon() {
    const settings = window.extension_settings[Constants.EXTENSION_NAME];
    const customIconUrlInput = document.getElementById(Constants.ID_CUSTOM_ICON_URL);
    const customIconSize = parseInt(document.getElementById(Constants.ID_CUSTOM_ICON_SIZE_INPUT).value, 10);

    // 核心修复：优先从 dataset.fullValue 获取 URL，如果它存在且输入框是占位符。
    // 否则，使用输入框的当前 .value。
    // "别人"的简洁方案: const urlToSave = customIconUrlInput.dataset.fullValue ? customIconUrlInput.dataset.fullValue : customIconUrlInput.value;
    // 我们的 settings.customIconUrl 应该已经是权威的了，由 handleSettingsChange 和 handleFileUpload 维护。
    const urlToSave = settings.customIconUrl; // 直接从 settings 对象取，它应该是最新的真实数据

    if (!urlToSave || !urlToSave.trim()) { // 检查 settings.customIconUrl
        const saveStatus = document.getElementById('qr-save-status');
        if (saveStatus) {
            saveStatus.textContent = '请先输入图标URL或上传图片';
            saveStatus.style.color = '#f44336';
            setTimeout(() => { saveStatus.textContent = ''; }, 2000);
        }
        return;
    }

    if (!settings.savedCustomIcons) {
        settings.savedCustomIcons = [];
    }

    // 优化默认名称生成
    let defaultName = '';
    try {
        if (urlToSave.startsWith('data:image')) {
            const typePart = urlToSave.substring(5, urlToSave.indexOf(';')); // e.g., "image/png"
            const ext = typePart.split('/')[1] || 'img';
            defaultName = `${ext.toUpperCase()}_${new Date().getTime().toString().slice(-6)}`;
        } else if (urlToSave.startsWith('<svg')) {
            defaultName = `SVG_${new Date().getTime().toString().slice(-6)}`;
        } else {
            const urlObj = new URL(urlToSave); // 尝试解析为URL
            const pathParts = urlObj.pathname.split('/');
            let filename = decodeURIComponent(pathParts[pathParts.length - 1]);
            if (filename.includes('.')) filename = filename.substring(0, filename.lastIndexOf('.')); //移除扩展名
            defaultName = filename.substring(0, 20) || `WebIcon_${new Date().getTime().toString().slice(-6)}`;
        }
    } catch (e) {
        defaultName = `图标_${new Date().getTime().toString().slice(-6)}`;
    }
    defaultName = defaultName.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 25); // 清理并截断

    const iconName = prompt("请输入图标名称:", defaultName);
    if (iconName === null) return; // 用户取消

    const newIconData = {
        id: `icon_${new Date().getTime()}`,
        name: iconName.trim() || defaultName,
        url: urlToSave, // 使用来自 settings.customIconUrl 的真实数据
        size: customIconSize
    };

    settings.savedCustomIcons.push(newIconData);
    updateCustomIconSelect();

    // 保存后，自动选中新保存的项，并更新删除按钮状态
    const selectElement = document.getElementById(Constants.ID_CUSTOM_ICON_SELECT);
    if (selectElement) selectElement.value = newIconData.id;
    sharedState.currentSelectedSavedIconId = newIconData.id;
    const deleteBtn = document.getElementById(Constants.ID_DELETE_SAVED_ICON_BUTTON);
    if (deleteBtn) deleteBtn.style.display = 'inline-block';


    const saveStatus = document.getElementById('qr-save-status');
    if (saveStatus) {
        saveStatus.textContent = `✓ 图标"${newIconData.name}"已保存`;
        saveStatus.style.color = '#4caf50';
        setTimeout(() => { saveStatus.textContent = ''; }, 2000);
    }
}

/**
 * 更新自定义图标选择下拉菜单
 */
function updateCustomIconSelect() {
    const settings = window.extension_settings[Constants.EXTENSION_NAME];
    const selectElement = document.getElementById(Constants.ID_CUSTOM_ICON_SELECT);
    
    if (!selectElement || !settings.savedCustomIcons) return;
    
    // 清空当前选项（保留第一个默认选项）
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }
    
    // 添加已保存的图标选项
    settings.savedCustomIcons.forEach(icon => {
        const option = document.createElement('option');
        option.value = icon.id;
        option.textContent = icon.name;
        selectElement.appendChild(option);
    });
}

/**
 * 选择并应用已保存的自定义图标
 */
function handleCustomIconSelect(event) {
    const selectedId = event.target.value;
    const deleteBtn = document.getElementById(Constants.ID_DELETE_SAVED_ICON_BUTTON);

    if (!selectedId) {
        sharedState.currentSelectedSavedIconId = null;
        if (deleteBtn) deleteBtn.style.display = 'none';
        // 可选：如果取消选择，是否要清除当前输入框？或者保留？当前逻辑是保留。
        return;
    }

    const settings = window.extension_settings[Constants.EXTENSION_NAME];
    if (!settings.savedCustomIcons) {
        sharedState.currentSelectedSavedIconId = null;
        if (deleteBtn) deleteBtn.style.display = 'none';
        return;
    }

    const selectedIcon = settings.savedCustomIcons.find(icon => icon.id === selectedId);
    if (!selectedIcon) {
        sharedState.currentSelectedSavedIconId = null;
        if (deleteBtn) deleteBtn.style.display = 'none';
        return;
    }

    // 1. 更新 settings 对象 (权威数据源)
    settings.iconType = Constants.ICON_TYPES.CUSTOM;
    settings.customIconUrl = selectedIcon.url; // 真实数据
    settings.customIconSize = selectedIcon.size;

    // 2. 更新 DOM 元素以反映 settings
    document.getElementById(Constants.ID_ICON_TYPE_DROPDOWN).value = Constants.ICON_TYPES.CUSTOM;
    const customIconUrlInput = document.getElementById(Constants.ID_CUSTOM_ICON_URL);
    if (selectedIcon.url.length > 1000) {
        customIconUrlInput.dataset.fullValue = selectedIcon.url;
        customIconUrlInput.value = "[图片数据已保存，但不在输入框显示以提高性能]";
    } else {
        customIconUrlInput.value = selectedIcon.url;
        delete customIconUrlInput.dataset.fullValue;
    }
    document.getElementById(Constants.ID_CUSTOM_ICON_SIZE_INPUT).value = selectedIcon.size;

    // 3. 更新共享状态和UI
    sharedState.currentSelectedSavedIconId = selectedId;
    if (deleteBtn) deleteBtn.style.display = 'inline-block';

    updateIconDisplay(); // 使用更新后的 settings 来刷新按钮

    const saveStatus = document.getElementById('qr-save-status');
    if (saveStatus) {
        saveStatus.textContent = '图标已应用，请保存设置';
        saveStatus.style.color = '#ff9800';
        setTimeout(() => { if(saveStatus.textContent === '图标已应用，请保存设置') saveStatus.textContent = ''; }, 3000);
    }
}

// 新增函数处理全局图标大小重置
function handleResetIconSize() {
    const settings = extension_settings[Constants.EXTENSION_NAME];
    settings.globalIconSize = null; // 重置为 null
    const globalIconSizeInput = document.getElementById(Constants.ID_GLOBAL_ICON_SIZE_INPUT);
    if (globalIconSizeInput) {
        globalIconSizeInput.value = ""; // 清空输入框
    }
    updateIconDisplay();
    // 可以在这里加一个提示，提示用户保存设置
    const saveStatus = document.getElementById('qr-save-status');
    if (saveStatus) {
        saveStatus.textContent = '全局图标大小已重置，请保存设置';
        saveStatus.style.color = '#ff9800';
        setTimeout(() => { if(saveStatus.textContent.includes('全局图标大小已重置')) saveStatus.textContent = ''; }, 3000);
    }
}

/**
 * 处理删除已保存图标的操作
 */
function handleDeleteSavedIcon() {
    const settings = window.extension_settings[Constants.EXTENSION_NAME];
    const selectedId = sharedState.currentSelectedSavedIconId;
    
    if (!selectedId || !settings.savedCustomIcons) {
        return;
    }

    // 找到要删除的图标及其索引
    const iconIndex = settings.savedCustomIcons.findIndex(icon => icon.id === selectedId);
    if (iconIndex === -1) {
        return;
    }
    
    // 获取要删除的图标
    const deletedIcon = settings.savedCustomIcons[iconIndex];
    
    // 确认删除
    if (!confirm(`确定要删除图标"${deletedIcon.name}"吗？`)) {
        return;
    }

    // --- 修复开始：如果删除的是当前正在使用的图标，清理相关状态 ---
    // 检查是否正在使用这个被删除的图标（通过URL和尺寸比对）
    const isCurrentlyUsed = 
        settings.customIconUrl === deletedIcon.url && 
        settings.customIconSize === deletedIcon.size;

    // 从数组中移除图标
    settings.savedCustomIcons.splice(iconIndex, 1);

    if (isCurrentlyUsed) {
        // 清理图标相关状态
        settings.customIconUrl = '';  // 清空URL
        
        // 清理输入框状态
        const customIconUrlInput = document.getElementById(Constants.ID_CUSTOM_ICON_URL);
        if (customIconUrlInput) {
            customIconUrlInput.value = '';  // 清空输入框显示值
            delete customIconUrlInput.dataset.fullValue;  // 清除保存的完整值
        }
        
        // 重置图标尺寸为默认值
        const customIconSizeInput = document.getElementById(Constants.ID_CUSTOM_ICON_SIZE_INPUT);
        if (customIconSizeInput) {
            settings.customIconSize = Constants.DEFAULT_CUSTOM_ICON_SIZE;
            customIconSizeInput.value = Constants.DEFAULT_CUSTOM_ICON_SIZE;
        }

        // 重置选中状态
        sharedState.currentSelectedSavedIconId = null;
        
        // 隐藏删除按钮
        const deleteBtn = document.getElementById(Constants.ID_DELETE_SAVED_ICON_BUTTON);
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
        
        // 更新图标显示
        updateIconDisplay();
        
        // 显示提示消息
        const saveStatus = document.getElementById('qr-save-status');
        if (saveStatus) {
            saveStatus.textContent = '已删除当前使用的图标，请保存设置';
            saveStatus.style.color = '#ff9800';
            setTimeout(() => { 
                if (saveStatus.textContent === '已删除当前使用的图标，请保存设置') {
                    saveStatus.textContent = '';
                }
            }, 3000);
        }
    } else {
        // 非当前使用的图标被删除时的提示
        const saveStatus = document.getElementById('qr-save-status');
        if (saveStatus) {
            saveStatus.textContent = `✓ 图标"${deletedIcon.name}"已删除`;
            saveStatus.style.color = '#4caf50';
            setTimeout(() => { saveStatus.textContent = ''; }, 2000);
        }
    }
    // --- 修复结束 ---

    // 更新下拉选择框
    updateCustomIconSelect();
    
    // 若被删除的是当前选中项，重置选择框
    const selectElement = document.getElementById(Constants.ID_CUSTOM_ICON_SELECT);
    if (selectElement && selectedId === sharedState.currentSelectedSavedIconId) {
        selectElement.value = "";
    }
}

export async function populateWhitelistManagementUI() {
    const settings = extension_settings[Constants.EXTENSION_NAME];
    const { chat, global } = fetchQuickReplies();
    const allReplies = [...(chat || []), ...(global || [])];
    const map = new Map();
    allReplies.forEach(r => {
        if (r.source === 'QuickReplyV2') {
            const id = `QRV2::${r.setName}`;
            if (!map.has(id)) map.set(id, { scopedId: id, displayName: `[QRv2] ${r.setName}` });
        } else if (r.source === 'JSSlashRunner') {
            const id = `JSR::${r.scriptId}`;
            if (!map.has(id)) map.set(id, { scopedId: id, displayName: `[JSR] ${r.setName}` });
        }
    });

    const nonList = document.getElementById('qrq-non-whitelisted-list');
    const wlList = document.getElementById('qrq-whitelisted-list');
    if (!nonList || !wlList) return;
    nonList.innerHTML = '';
    wlList.innerHTML = '';
    map.forEach(({ scopedId, displayName }) => {
        const option = document.createElement('option');
        option.value = scopedId;
        option.textContent = displayName;
        if (settings.whitelist.includes(scopedId)) {
            wlList.appendChild(option);
        } else {
            nonList.appendChild(option);
        }
    });
}

// --- 更改开始：移除旧的 handleAddToWhitelist 和 handleRemoveFromWhitelist 函数 ---
// function handleAddToWhitelist() { ... } // 已移除
// function handleRemoveFromWhitelist() { ... } // 已移除
// --- 更改结束 ---

// --- 更改开始：修改 setupSettingsEventListeners 来实现新的点击交互逻辑 ---
setupSettingsEventListeners = (function(orig){
    return function(){
        orig(); // 调用原始的 setupSettingsEventListeners

        // 新的白名单交互逻辑
        const nonList = document.getElementById('qrq-non-whitelisted-list');
        const wlList = document.getElementById('qrq-whitelisted-list');
        const status = document.getElementById('qrq-whitelist-save-status');

        // 处理从“非白名单”移动到“白名单”
        if (nonList) {
            nonList.addEventListener('click', (event) => {
                if (event.target.tagName === 'OPTION') {
                    const option = event.target;
                    const settings = extension_settings[Constants.EXTENSION_NAME];
                    if (!settings.whitelist.includes(option.value)) {
                        settings.whitelist.push(option.value);
                    }
                    populateWhitelistManagementUI();
                    if (window.quickReplyMenu?.applyWhitelistDOMChanges) window.quickReplyMenu.applyWhitelistDOMChanges();
                    if (status) {
                        status.textContent = '已更新，关闭面板时将自动保存。';
                        status.style.color = '#ff9800'; // 使用警告色提示需要保存
                    }
                }
            });
        }

        // 处理从“白名单”移动到“非白名单”
        if (wlList) {
            wlList.addEventListener('click', (event) => {
                if (event.target.tagName === 'OPTION') {
                    const option = event.target;
                    const settings = extension_settings[Constants.EXTENSION_NAME];
                    const idx = settings.whitelist.indexOf(option.value);
                    if (idx > -1) {
                        settings.whitelist.splice(idx, 1);
                    }
                    populateWhitelistManagementUI();
                    if (window.quickReplyMenu?.applyWhitelistDOMChanges) window.quickReplyMenu.applyWhitelistDOMChanges();
                    if (status) {
                        status.textContent = '已更新，关闭面板时将自动保存。';
                        status.style.color = '#ff9800';
                    }
                }
            });
        }

        // 移除旧的箭头按钮监听器（因为按钮已经不存在了，这是为了代码的健壮性）
        const addBtn = document.getElementById('qrq-add-to-whitelist-btn');
        const rmBtn = document.getElementById('qrq-remove-from-whitelist-btn');
        if(addBtn) addBtn.removeEventListener('click', () => {}); // 简单移除，防止旧逻辑残留
        if(rmBtn) rmBtn.removeEventListener('click', () => {});
    };
})(setupSettingsEventListeners);
// --- 更改结束 ---