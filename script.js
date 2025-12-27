// ================================================
// 🎰 SISTEMA DROP VIP MANUAL - VERSIÓN 5.0
// ================================================

const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbymfbEdYZN74EPtFwVLEtfNpm-_t8ge-7lrMtCt2rxpHF269z-BD34902qb9YAcbdmttw/exec',
    UPDATE_INTERVAL: 2000,
    DROP_DURATION: 60 * 60 * 1000, // 1 HORA
    COUNTDOWN_SECONDS: 10, // 10 SEGUNDOS
    WHATSAPP_NUMBER: '+3765300975',
    WHATSAPP_MESSAGE: 'Hola! Tengo un código VIP para canjear: [CODIGO]'
};

const AppState = {
    dropActive: false,
    codesAvailable: false,
    dropEndTime: null,
    codesStartTime: null,
    usedCodes: [],
    adminPanelVisible: false,
    currentCodes: [],
    currentDropId: null,
    dropStartTime: null,
    apiConnected: false,
    lastUpdate: null,
    retryCount: 0,
    isUpdating: false,
    redeemingCodes: new Set(),
    claimedCodes: new Set(),
    totalDrops: 0,
    totalUsedCodes: 0,
    lastAction: null,
    connectionRetryTimer: null
};

const DOM = {};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎰 Sistema DROP VIP v5.0 inicializando...');
    
    initializeDOM();
    setupEventListeners();
    startSystem();
});

function initializeDOM() {
    DOM.statusCard = document.getElementById('statusCard');
    DOM.statusIndicator = document.getElementById('statusIndicator');
    DOM.timer = document.getElementById('timer');
    DOM.countdownTitle = document.getElementById('countdownTitle');
    DOM.availableCodes = document.getElementById('availableCodes');
    DOM.codesContainer = document.getElementById('codesContainer');
    DOM.nextDrop = document.getElementById('nextDrop');
    DOM.dropId = document.getElementById('dropId');
    DOM.dropStart = document.getElementById('dropStart');
    DOM.connectionStatus = document.getElementById('connectionStatus');
    DOM.apiStatus = document.getElementById('apiStatus');
    DOM.lastUpdate = document.getElementById('lastUpdate');
    DOM.adminToggleBtn = document.getElementById('adminToggleBtn');
    DOM.adminPanel = document.getElementById('adminPanel');
    DOM.adminPassword = document.getElementById('adminPassword');
    DOM.activateDropBtn = document.getElementById('activateDropBtn');
    DOM.resetSystemBtn = document.getElementById('resetSystemBtn');
    DOM.checkApiBtn = document.getElementById('checkApiBtn');
    DOM.forceRefreshBtn = document.getElementById('forceRefreshBtn');
    DOM.totalDrops = document.getElementById('totalDrops');
    DOM.totalUsedCodes = document.getElementById('totalUsedCodes');
    DOM.lastAction = document.getElementById('lastAction');
    DOM.toastContainer = document.getElementById('toastContainer');
}

function setupEventListeners() {
    DOM.adminToggleBtn.addEventListener('click', toggleAdminPanel);
    DOM.activateDropBtn.addEventListener('click', activateDrop);
    DOM.resetSystemBtn.addEventListener('click', resetSystem);
    DOM.checkApiBtn.addEventListener('click', checkApiStatus);
    DOM.forceRefreshBtn.addEventListener('click', () => {
        updateStatus(true);
        showToast('🔄 Actualización forzada', 'info');
    });
    
    window.addEventListener('beforeunload', () => {
        if (AppState.connectionRetryTimer) {
            clearTimeout(AppState.connectionRetryTimer);
        }
    });
}

function startSystem() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
    loadInitialData();
    setInterval(() => updateStatus(false), CONFIG.UPDATE_INTERVAL);
    setInterval(checkCodesAvailability, 500);
}

function loadInitialData() {
    showToast('Conectando con el servidor...', 'info');
    updateStatus(true);
}

async function updateStatus(force = false) {
    if (AppState.isUpdating && !force) return;
    
    AppState.isUpdating = true;
    
    try {
        console.log('🔄 [FRONT] Actualizando estado...');
        const data = await callApi('estado');
        
        if (data && data.exito) {
            console.log('✅ [FRONT] Datos recibidos:', data);
            processApiResponse(data);
            updateConnectionStatus(true);
            updateLastUpdateTime();
            AppState.retryCount = 0;
            
        } else {
            console.error('❌ [FRONT] Error en API:', data ? data.error : 'Error desconocido');
            handleApiError(data ? data.error : 'Error desconocido');
        }
    } catch (error) {
        console.error('❌ [FRONT] Error en updateStatus:', error);
        handleApiError(error.message);
    } finally {
        AppState.isUpdating = false;
    }
}

function processApiResponse(data) {
    console.log('🎯 [FRONT] Procesando respuesta:', {
        dropActivo: data.dropActivo,
        codigosDisponibles: data.codigosDisponibles,
        tiempoParaCodigos: data.tiempoParaCodigos,
        tiempoRestante: data.tiempoRestante
    });
    
    const wasActive = AppState.dropActive;
    const wereCodesAvailable = AppState.codesAvailable;
    const oldDropId = AppState.currentDropId;
    
    AppState.dropActive = data.dropActivo;
    AppState.codesAvailable = data.codigosDisponibles || false;
    AppState.dropEndTime = data.tiempoRestante ? new Date(data.tiempoRestante) : null;
    AppState.codesStartTime = data.tiempoParaCodigos ? new Date(data.tiempoParaCodigos) : null;
    AppState.usedCodes = data.codigosUsados || [];
    AppState.apiConnected = true;
    AppState.lastUpdate = new Date();
    
    if (data.datosDrop) {
        AppState.currentDropId = data.datosDrop.idDrop || `DROP_${Date.now()}`;
        AppState.dropStartTime = new Date(data.datosDrop.horaInicio);
        AppState.currentCodes = [
            data.datosDrop.codigo1,
            data.datosDrop.codigo2,
            data.datosDrop.codigo3
        ].filter(code => code && code.trim() !== '');
        
        AppState.totalUsedCodes = AppState.usedCodes.length;
    }
    
    console.log('🎯 [FRONT] Estado actualizado:', {
        dropActive: AppState.dropActive,
        codesAvailable: AppState.codesAvailable,
        codesStartTime: AppState.codesStartTime,
        dropEndTime: AppState.dropEndTime
    });
    
    updateUI();
    updateAdminInfo();
    
    if (oldDropId !== AppState.currentDropId && data.dropActivo) {
        showToast(`🎉 ¡NUEVO DROP ACTIVADO! Códigos en ${CONFIG.COUNTDOWN_SECONDS}s...`, 'success');
    }
    
    if (!wereCodesAvailable && AppState.codesAvailable) {
        showToast('🎰 ¡CÓDIGOS DISPONIBLES! ¡Ya puedes canjear!', 'success');
    }
}

function handleApiError(error) {
    console.error('❌ [FRONT] Error en la API:', error);
    
    AppState.retryCount++;
    
    if (AppState.retryCount <= 3) {
        showToast(`Reintentando conexión (${AppState.retryCount}/3)...`, 'warning');
        updateConnectionStatus(false);
        
        clearTimeout(AppState.connectionRetryTimer);
        AppState.connectionRetryTimer = setTimeout(() => {
            updateStatus(true);
        }, 3000);
    } else {
        showToast('Error de conexión persistente', 'error');
        updateConnectionStatus('error');
        
        setTimeout(() => {
            AppState.retryCount = 0;
        }, 30000);
    }
}

async function callApi(action, params = {}) {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.append('accion', action);
    
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            url.searchParams.append(key, params[key]);
        }
    });
    
    url.searchParams.append('_t', Date.now());
    
    console.log('🌐 [FRONT] Llamando a API:', url.toString());
    
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('🌐 [FRONT] Respuesta API:', data);
        return data;
        
    } catch (error) {
        console.log('🌐 [FRONT] Método directo falló, intentando con proxy...');
        
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url.toString())}`;
            const response = await fetch(proxyUrl, {
                method: 'GET',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`Proxy HTTP ${response.status}`);
            }
            
            const data = await response.json();
            return JSON.parse(data.contents);
            
        } catch (proxyError) {
            throw new Error('No se pudo conectar con el servidor');
        }
    }
}

function updateUI() {
    console.log('🎨 [FRONT] Actualizando UI:', {
        dropActive: AppState.dropActive,
        codesAvailable: AppState.codesAvailable,
        codesStartTime: AppState.codesStartTime
    });
    
    if (AppState.dropActive) {
        if (AppState.codesAvailable) {
            DOM.statusIndicator.className = 'status-indicator status-active';
            DOM.statusIndicator.innerHTML = '<i class="fas fa-circle"></i> DROP ACTIVO - CÓDIGOS DISPONIBLES';
            DOM.statusCard.classList.add('drop-active');
            DOM.statusCard.classList.remove('drop-waiting');
            DOM.countdownTitle.textContent = 'DROP finaliza en';
        } else {
            DOM.statusIndicator.className = 'status-indicator status-waiting';
            DOM.statusIndicator.innerHTML = `<i class="fas fa-circle"></i> DROP ACTIVO - CÓDIGOS EN ${formatTimeRemainingForCodes()}s`;
            DOM.statusCard.classList.add('drop-waiting');
            DOM.statusCard.classList.remove('drop-active');
            DOM.countdownTitle.textContent = 'Códigos disponibles en';
        }
    } else {
        DOM.statusIndicator.className = 'status-indicator status-inactive';
        DOM.statusIndicator.innerHTML = '<i class="fas fa-circle"></i> DROP INACTIVO';
        DOM.statusCard.classList.remove('drop-active', 'drop-waiting');
        DOM.countdownTitle.textContent = 'Esperando nuevo DROP';
    }
    
    updateCodesDisplay();
    updateDropInfo();
    
    if (!AppState.dropActive) {
        DOM.nextDrop.textContent = 'MANUAL - Espera activación';
    } else {
        DOM.nextDrop.textContent = formatDateTime(AppState.dropEndTime);
    }
}

function updateDropInfo() {
    if (!AppState.currentDropId) return;
    
    DOM.dropId.textContent = AppState.currentDropId || '---';
    
    if (AppState.dropStartTime) {
        DOM.dropStart.textContent = formatTime(AppState.dropStartTime);
    }
}

function updateCodesDisplay() {
    console.log('📱 [FRONT] Actualizando códigos:', {
        dropActive: AppState.dropActive,
        codesAvailable: AppState.codesAvailable,
        currentCodes: AppState.currentCodes
    });
    
    if (!AppState.dropActive) {
        DOM.codesContainer.innerHTML = `
            <div class="no-codes-message">
                <i class="fas fa-clock"></i>
                <h3>Esperando nuevo DROP</h3>
                <p>No hay ningún drop activo en este momento.</p>
                <p class="small">El administrador debe activar un nuevo drop manualmente.</p>
                <button class="refresh-btn" onclick="updateStatus(true)">
                    <i class="fas fa-sync-alt"></i> Actualizar
                </button>
            </div>
        `;
        DOM.availableCodes.textContent = '0';
        return;
    }
    
    if (!AppState.codesAvailable) {
        const secondsLeft = formatTimeRemainingForCodes();
        console.log('⏱️ [FRONT] Segundos restantes para códigos:', secondsLeft);
        
        DOM.codesContainer.innerHTML = `
            <div class="no-codes-message">
                <i class="fas fa-hourglass-start"></i>
                <h3>CÓDIGOS DISPONIBLES EN:</h3>
                <div class="timer-large">${secondsLeft}s</div>
                <p>Los códigos VIP se mostrarán automáticamente cuando el contador llegue a 0.</p>
                <p class="small">¡Prepárate para canjear!</p>
            </div>
        `;
        DOM.availableCodes.textContent = '0';
        return;
    }
    
    if (AppState.currentCodes.length === 0) {
        DOM.codesContainer.innerHTML = `
            <div class="no-codes-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error al cargar códigos</h3>
                <button class="refresh-btn" onclick="updateStatus(true)">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
        return;
    }
    
    const codes = [
        { code: AppState.currentCodes[0], prize: '1000 FICHAS' },
        { code: AppState.currentCodes[1], prize: '10% EXTRA EN FICHAS' },
        { code: AppState.currentCodes[2], prize: '5% EXTRA EN FICHAS' }
    ];
    
    let html = '';
    let availableCount = 0;
    
    codes.forEach((item, index) => {
        const isUsed = AppState.usedCodes.includes(item.code) || AppState.claimedCodes.has(item.code);
        const isClaiming = AppState.redeemingCodes.has(item.code);
        const hasCode = item.code && item.code.trim() !== '';
        
        if (!hasCode) return;
        
        if (!isUsed && !isClaiming) availableCount++;
        
        html += `
            <div class="code-item ${isUsed ? 'code-used-item' : ''}">
                <div class="code-label">${item.prize}</div>
                <div class="code-value ${isUsed ? 'code-used' : ''} ${isClaiming ? 'code-claiming' : ''}" 
                     onclick="${!isUsed && !isClaiming ? `copyCode('${item.code}')` : ''}"
                     title="${!isUsed && !isClaiming ? 'Haz clic para copiar' : (isUsed ? 'Ya reclamado' : 'En proceso...')}">
                    ${item.code}
                    ${isClaiming ? '<div class="claiming-overlay"><i class="fas fa-spinner fa-spin"></i></div>' : ''}
                </div>
                ${isUsed ? 
                    `<div class="code-status claimed">
                        <i class="fas fa-check-circle"></i> Canjeado
                    </div>` : 
                    (isClaiming ?
                        `<button class="redeem-btn claiming" disabled>
                            <i class="fas fa-spinner fa-spin"></i> Canjeando...
                        </button>` :
                        `<button class="redeem-btn" onclick="redeemCode('${item.code}', ${index})">
                            <i class="fab fa-whatsapp"></i> Canjear
                        </button>`
                    )
                }
            </div>
        `;
    });
    
    DOM.codesContainer.innerHTML = html;
    DOM.availableCodes.textContent = availableCount;
}

function updateConnectionStatus(connected) {
    if (!DOM.connectionStatus || !DOM.apiStatus) return;
    
    if (connected === true) {
        DOM.connectionStatus.className = 'connection-status connected';
        DOM.connectionStatus.innerHTML = '<i class="fas fa-check-circle"></i> Conectado al servidor';
        DOM.apiStatus.innerHTML = 'Estado: <span class="status-connected">Conectado ✓</span>';
    } else if (connected === 'error') {
        DOM.connectionStatus.className = 'connection-status error';
        DOM.connectionStatus.innerHTML = '<i class="fas fa-times-circle"></i> Error de conexión';
        DOM.apiStatus.innerHTML = 'Estado: <span class="status-error">Desconectado ✗</span>';
    } else {
        DOM.connectionStatus.className = 'connection-status';
        DOM.connectionStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Conectando...';
        DOM.apiStatus.innerHTML = 'Estado: <span class="status-connecting">Conectando...</span>';
    }
}

function updateAdminInfo() {
    if (DOM.totalDrops) {
        DOM.totalDrops.textContent = AppState.totalDrops;
    }
    
    if (DOM.totalUsedCodes) {
        DOM.totalUsedCodes.textContent = AppState.totalUsedCodes + AppState.claimedCodes.size;
    }
    
    if (DOM.lastAction) {
        const now = new Date();
        DOM.lastAction.textContent = formatTime(now);
    }
    
    if (AppState.dropActive) {
        DOM.activateDropBtn.disabled = true;
        DOM.activateDropBtn.innerHTML = '<i class="fas fa-ban"></i> Drop Activo';
    } else {
        DOM.activateDropBtn.disabled = false;
        DOM.activateDropBtn.innerHTML = '<i class="fas fa-play-circle"></i> Activar Drop';
    }
}

function updateLastUpdateTime() {
    if (DOM.lastUpdate) {
        const now = new Date();
        DOM.lastUpdate.textContent = formatTime(now);
    }
}

function updateCountdown() {
    const now = new Date();
    
    console.log('⏱️ [FRONT] UpdateCountdown:', {
        dropActive: AppState.dropActive,
        codesAvailable: AppState.codesAvailable,
        codesStartTime: AppState.codesStartTime,
        dropEndTime: AppState.dropEndTime,
        now: now
    });
    
    if (AppState.dropActive) {
        if (!AppState.codesAvailable) {
            // FASE 1: CONTADOR DE 10 SEGUNDOS
            if (AppState.codesStartTime) {
                const diff = AppState.codesStartTime - now;
                console.log('⏱️ [FRONT] Fase 1 - diff:', diff);
                
                if (diff <= 0) {
                    DOM.timer.textContent = '00:00:00';
                    setTimeout(() => updateStatus(true), 500);
                    return;
                }
                
                const seconds = Math.ceil(diff / 1000);
                DOM.timer.textContent = `00:00:${seconds.toString().padStart(2, '0')}`;
                DOM.timer.style.color = '#2196F3';
                DOM.timer.style.animation = 'pulse 1s infinite';
            }
        } else {
            // FASE 2: CONTADOR DE 1 HORA
            if (AppState.dropEndTime) {
                const diff = AppState.dropEndTime - now;
                console.log('⏱️ [FRONT] Fase 2 - diff:', diff);
                
                if (diff <= 0) {
                    DOM.timer.textContent = '00:00:00';
                    setTimeout(() => updateStatus(true), 1000);
                    return;
                }
                
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                
                DOM.timer.textContent = 
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                
                if (diff < 300000) { // 5 minutos
                    DOM.timer.style.color = '#FF5252';
                    DOM.timer.style.animation = 'pulse 1s infinite';
                } else if (diff < 900000) { // 15 minutos
                    DOM.timer.style.color = '#FF9800';
                } else {
                    DOM.timer.style.color = '#FFD700';
                }
            }
        }
    } else {
        DOM.timer.textContent = '--:--:--';
        DOM.timer.style.color = '#777';
    }
}

function formatTimeRemainingForCodes() {
    if (!AppState.codesStartTime || AppState.codesAvailable) return '0';
    
    const now = new Date();
    const diff = AppState.codesStartTime - now;
    
    if (diff <= 0) return '0';
    
    return Math.ceil(diff / 1000);
}

window.redeemCode = async function(code, index) {
    console.log('🎯 [FRONT] Intentando canjear código:', code);
    
    if (!AppState.dropActive || !AppState.codesAvailable) {
        showToast('❌ El drop no está activo', 'error');
        return;
    }
    
    if (!code || code.trim() === '') {
        showToast('❌ Código no válido', 'error');
        return;
    }
    
    if (AppState.usedCodes.includes(code)) {
        showToast('❌ Este código ya fue reclamado', 'error');
        return;
    }
    
    if (AppState.claimedCodes.has(code)) {
        showToast('❌ Este código ya está siendo canjeado', 'warning');
        return;
    }
    
    AppState.redeemingCodes.add(code);
    updateCodesDisplay();
    
    try {
        await copyToClipboard(code);
        
        const apiResponse = await callApi('usarCodigo', { codigo: code });
        
        if (apiResponse.exito) {
            AppState.redeemingCodes.delete(code);
            AppState.claimedCodes.add(code);
            AppState.usedCodes.push(code);
            AppState.totalUsedCodes++;
            
            updateCodesDisplay();
            updateAdminInfo();
            
            showToast(`✅ ${apiResponse.mensaje}`, 'success');
            
            setTimeout(() => {
                openWhatsAppWithCode(code);
            }, 500);
            
            setTimeout(() => updateStatus(true), 2000);
            
        } else {
            AppState.redeemingCodes.delete(code);
            updateCodesDisplay();
            
            showToast(`❌ ${apiResponse.error || 'Error al registrar código'}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ [FRONT] Error en canje:', error);
        
        AppState.redeemingCodes.delete(code);
        updateCodesDisplay();
        
        showToast('❌ Error al procesar el canje', 'error');
    }
};

window.copyCode = async function(code) {
    if (!code || code.trim() === '') return;
    await copyToClipboard(code);
};

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`✅ Código copiado: ${text}`, 'success');
        return true;
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showToast(`✅ Código copiado: ${text}`, 'success');
            return true;
        } catch (copyError) {
            showToast('No se pudo copiar el código', 'error');
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

function openWhatsAppWithCode(code) {
    const message = CONFIG.WHATSAPP_MESSAGE.replace('[CODIGO]', code);
    const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

async function activateDrop() {
    const password = DOM.adminPassword.value.trim();
    
    if (!password) {
        showToast('❌ Ingresa la contraseña', 'error');
        return;
    }
    
    if (AppState.dropActive) {
        showToast('❌ Ya hay un DROP activo', 'error');
        return;
    }
    
    if (!confirm(`⚠️ ¿ACTIVAR NUEVO DROP?\n\n• Habrá ${CONFIG.COUNTDOWN_SECONDS} segundos de espera\n• Los códigos estarán disponibles por 1 hora\n• Solo puedes activar uno a la vez`)) {
        return;
    }
    
    DOM.activateDropBtn.disabled = true;
    const originalText = DOM.activateDropBtn.innerHTML;
    DOM.activateDropBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activando...';
    
    try {
        console.log('🚀 [FRONT] Activando drop...');
        const response = await callApi('activarDrop', { contrasena: password });
        
        if (response.exito) {
            showToast('✅ ' + response.mensaje, 'success');
            DOM.adminPassword.value = '';
            
            AppState.claimedCodes.clear();
            AppState.redeemingCodes.clear();
            
            AppState.totalDrops++;
            localStorage.setItem('totalDrops', AppState.totalDrops);
            
            setTimeout(() => updateStatus(true), 1000);
        } else {
            showToast('❌ ' + (response.error || 'Error al activar'), 'error');
        }
    } catch (error) {
        console.error('❌ [FRONT] Error al activar:', error);
        showToast('❌ Error de conexión', 'error');
    } finally {
        DOM.activateDropBtn.innerHTML = originalText;
        DOM.activateDropBtn.disabled = AppState.dropActive;
    }
}

async function resetSystem() {
    const password = DOM.adminPassword.value.trim();
    
    if (!password) {
        showToast('❌ Ingresa la contraseña', 'error');
        return;
    }
    
    if (!confirm('⚠️ ¿ESTÁS SEGURO DE REINICIAR EL SISTEMA?\n\nEsta acción eliminará TODOS los drops y códigos actuales.\n\nEsta acción NO se puede deshacer.')) {
        return;
    }
    
    DOM.resetSystemBtn.disabled = true;
    const originalText = DOM.resetSystemBtn.innerHTML;
    DOM.resetSystemBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reiniciando...';
    
    try {
        const response = await callApi('reiniciar', { contrasena: password });
        
        if (response.exito) {
            showToast('✅ ' + response.mensaje, 'success');
            DOM.adminPassword.value = '';
            
            AppState.claimedCodes.clear();
            AppState.redeemingCodes.clear();
            AppState.totalDrops = 0;
            AppState.totalUsedCodes = 0;
            localStorage.setItem('totalDrops', '0');
            
            setTimeout(() => updateStatus(true), 2000);
        } else {
            showToast('❌ ' + (response.error || 'Error al reiniciar'), 'error');
        }
    } catch (error) {
        console.error('❌ [FRONT] Error al reiniciar:', error);
        showToast('❌ Error de conexión', 'error');
    } finally {
        DOM.resetSystemBtn.disabled = false;
        DOM.resetSystemBtn.innerHTML = originalText;
    }
}

async function checkApiStatus() {
    DOM.checkApiBtn.disabled = true;
    const originalText = DOM.checkApiBtn.innerHTML;
    DOM.checkApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    
    try {
        const response = await callApi('saludar');
        
        if (response.exito) {
            showToast('✅ API funcionando correctamente', 'success');
            updateConnectionStatus(true);
        } else {
            showToast('❌ API no responde', 'error');
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error('❌ [FRONT] Error al verificar API:', error);
        showToast('❌ No se pudo conectar', 'error');
        updateConnectionStatus('error');
    } finally {
        DOM.checkApiBtn.disabled = false;
        DOM.checkApiBtn.innerHTML = originalText;
    }
}

function toggleAdminPanel() {
    AppState.adminPanelVisible = !AppState.adminPanelVisible;
    
    if (AppState.adminPanelVisible) {
        DOM.adminPanel.classList.add('active');
        DOM.adminToggleBtn.innerHTML = '<i class="fas fa-lock-open"></i> Ocultar Panel';
        DOM.adminToggleBtn.style.borderColor = 'var(--primary)';
        DOM.adminToggleBtn.style.color = 'var(--light)';
    } else {
        DOM.adminPanel.classList.remove('active');
        DOM.adminToggleBtn.innerHTML = '<i class="fas fa-lock"></i> Panel de Administración';
        DOM.adminToggleBtn.style.borderColor = '';
        DOM.adminToggleBtn.style.color = '';
    }
}

function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-times-circle' : 
                 type === 'warning' ? 'fa-exclamation-circle' : 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
}

function formatDateTime(date) {
    if (!date || isNaN(date.getTime())) return 'No disponible';
    
    const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    
    return date.toLocaleDateString('es-ES', options);
}

function formatTime(date) {
    if (!date || isNaN(date.getTime())) return '--:--:--';
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}

function checkCodesAvailability() {
    if (AppState.dropActive && !AppState.codesAvailable && AppState.codesStartTime) {
        const now = new Date();
        if (now >= AppState.codesStartTime) {
            console.log('⏰ [FRONT] ¡Ya pasaron los 10 segundos! Actualizando...');
            updateStatus(true);
        }
    }
}

window.addEventListener('online', () => {
    showToast('🌐 Conexión restablecida', 'success');
    updateStatus(true);
});

window.addEventListener('offline', () => {
    showToast('🌐 Sin conexión', 'error');
    updateConnectionStatus('error');
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        updateStatus(true);
    }
});

setInterval(() => {
    if (!AppState.apiConnected && AppState.retryCount > 3) {
        updateStatus(true);
    }
}, 30000);