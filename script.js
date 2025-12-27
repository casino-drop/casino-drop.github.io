// ================================================
// 🎰 SISTEMA DROP VIP - VERSIÓN 3.2
// CONEXIÓN 100% ESTABLE - DROPS AUTOMÁTICOS - CÓDIGOS CANJEADOS EN TIEMPO REAL
// ================================================

// CONFIGURACIÓN - ¡REEMPLAZA ESTOS VALORES!
const CONFIG = {
    // ⚠️ ¡IMPORTANTE! Reemplaza con la URL de tu Web App de Google Apps Script
    API_URL: 'https://script.google.com/macros/s/AKfycbxLiv7YM-oBrWnWhZz-BKYvPgrSOeVF6vxhTA-akLzzvHLP_EuBtU7hjsGlVfqZreTU4/exec',
    
    // Configuración del sistema
    UPDATE_INTERVAL: 3000, // 3 segundos (más rápido para actualizar canjes)
    DROP_DURATION: 5 * 60 * 1000, // 5 minutos en milisegundos
    DROP_INTERVAL: 4 * 60 * 60 * 1000, // 4 horas en milisegundos
    
    // ¡REEMPLAZA CON TU NÚMERO DE WHATSAPP!
    WHATSAPP_NUMBER: '+3765300975',
    
    // Mensaje predeterminado para WhatsApp
    WHATSAPP_MESSAGE: 'Hola! Tengo un código VIP para canjear: [CODIGO]'
};

// ESTADO DE LA APLICACIÓN
const AppState = {
    dropActive: false,
    dropEndTime: null,
    nextDropTime: null,
    usedCodes: [], // Códigos ya canjeados
    adminPanelVisible: false,
    currentCodes: [], // Códigos actuales del drop
    currentDropId: null,
    dropStartTime: null,
    apiConnected: false,
    lastUpdate: null,
    retryCount: 0,
    isUpdating: false,
    connectionRetryTimer: null,
    totalDrops: 0,
    totalUsedCodes: 0,
    lastAction: null,
    redeemingCodes: new Set(), // Códigos que están siendo canjeados ahora
    claimedCodes: new Set() // Códigos reclamados en esta sesión
};

// CACHE DE ELEMENTOS DOM
const DOM = {};

// ================================================
// 📦 INICIALIZACIÓN
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎰 Sistema DROP VIP v3.2 inicializando...');
    
    // Inicializar elementos DOM
    initializeDOM();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Iniciar sistema
    startSystem();
});

// Inicializar elementos DOM
function initializeDOM() {
    // Estado y tiempo
    DOM.statusCard = document.getElementById('statusCard');
    DOM.statusIndicator = document.getElementById('statusIndicator');
    DOM.timer = document.getElementById('timer');
    DOM.countdownTitle = document.getElementById('countdownTitle');
    DOM.availableCodes = document.getElementById('availableCodes');
    DOM.codesContainer = document.getElementById('codesContainer');
    DOM.nextDrop = document.getElementById('nextDrop');
    
    // Información del drop
    DOM.dropId = document.getElementById('dropId');
    DOM.dropStart = document.getElementById('dropStart');
    
    // Estado de conexión
    DOM.connectionStatus = document.getElementById('connectionStatus');
    DOM.apiStatus = document.getElementById('apiStatus');
    DOM.lastUpdate = document.getElementById('lastUpdate');
    
    // Panel de administración
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
    
    // Toast container
    DOM.toastContainer = document.getElementById('toastContainer');
}

// Configurar event listeners
function setupEventListeners() {
    // Panel de administración
    DOM.adminToggleBtn.addEventListener('click', toggleAdminPanel);
    DOM.activateDropBtn.addEventListener('click', activateDrop);
    DOM.resetSystemBtn.addEventListener('click', resetSystem);
    DOM.checkApiBtn.addEventListener('click', checkApiStatus);
    DOM.forceRefreshBtn.addEventListener('click', () => {
        updateStatus(true);
        showToast('🔄 Actualización forzada', 'info');
    });
    
    // Limpiar temporizadores al salir de la página
    window.addEventListener('beforeunload', () => {
        if (AppState.connectionRetryTimer) {
            clearTimeout(AppState.connectionRetryTimer);
        }
    });
}

// Iniciar sistema
function startSystem() {
    // Iniciar actualización del contador
    updateCountdown();
    setInterval(updateCountdown, 1000);
    
    // Cargar datos iniciales
    loadInitialData();
    
    // Iniciar actualización periódica (más frecuente para detectar canjes)
    setInterval(() => updateStatus(false), CONFIG.UPDATE_INTERVAL);
}

// Cargar datos iniciales
function loadInitialData() {
    showToast('Conectando con el servidor...', 'info');
    updateStatus(true);
}

// ================================================
// 🔄 ACTUALIZACIÓN DEL ESTADO
// ================================================

// Actualizar estado del drop
async function updateStatus(force = false) {
    if (AppState.isUpdating && !force) return;
    
    AppState.isUpdating = true;
    
    try {
        const data = await callApi('estado');
        
        if (data && data.exito) {
            processApiResponse(data);
            updateConnectionStatus(true);
            updateLastUpdateTime();
            AppState.retryCount = 0;
            
        } else {
            handleApiError(data ? data.error : 'Error desconocido');
        }
    } catch (error) {
        handleApiError(error.message);
    } finally {
        AppState.isUpdating = false;
    }
}

// Procesar respuesta de la API
function processApiResponse(data) {
    const wasActive = AppState.dropActive;
    const oldDropId = AppState.currentDropId;
    
    // Actualizar estado
    AppState.dropActive = data.dropActivo;
    AppState.dropEndTime = new Date(data.tiempoRestante);
    AppState.nextDropTime = new Date(data.proximoDrop);
    AppState.usedCodes = data.codigosUsados || [];
    AppState.apiConnected = true;
    AppState.lastUpdate = new Date();
    
    // Actualizar información del drop
    if (data.datosDrop) {
        AppState.currentDropId = data.datosDrop.idDrop || `DROP_${Date.now()}`;
        AppState.dropStartTime = new Date(data.datosDrop.horaInicio);
        AppState.currentCodes = [
            data.datosDrop.codigo1,
            data.datosDrop.codigo2,
            data.datosDrop.codigo3
        ].filter(code => code && code.trim() !== '');
        
        // Actualizar estadísticas
        AppState.totalDrops = parseInt(localStorage.getItem('totalDrops') || '0');
        AppState.totalUsedCodes = AppState.usedCodes.length;
    }
    
    // Actualizar UI
    updateUI();
    updateAdminInfo();
    
    // Notificar cambios importantes
    if (oldDropId !== AppState.currentDropId) {
        showToast(`🎉 Nuevo DROP activado: ${AppState.currentDropId}`, 'success');
    }
    
    if (wasActive !== AppState.dropActive) {
        if (AppState.dropActive) {
            showToast('🎰 ¡DROP ACTIVO! Los códigos están disponibles', 'success');
        } else {
            showToast('⏰ DROP finalizado. Espera el próximo.', 'info');
        }
    }
}

// Manejar errores de API
function handleApiError(error) {
    console.error('❌ Error en la API:', error);
    
    AppState.retryCount++;
    
    if (AppState.retryCount <= 3) {
        showToast(`Reintentando conexión (${AppState.retryCount}/3)...`, 'warning');
        updateConnectionStatus(false);
        
        clearTimeout(AppState.connectionRetryTimer);
        AppState.connectionRetryTimer = setTimeout(() => {
            updateStatus(true);
        }, 3000);
    } else {
        showToast('Error de conexión persistente. Verifica tu internet.', 'error');
        updateConnectionStatus('error');
        
        setTimeout(() => {
            AppState.retryCount = 0;
        }, 30000);
    }
}

// ================================================
// 🌐 CONEXIÓN CON LA API
// ================================================

// Función para llamar a la API
async function callApi(action, params = {}) {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.append('accion', action);
    
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            url.searchParams.append(key, params[key]);
        }
    });
    
    url.searchParams.append('_t', Date.now());
    
    try {
        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
        
    } catch (error) {
        console.log('Método directo falló, intentando con proxy...');
        
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

// ================================================
// 🎨 INTERFAZ DE USUARIO (CON CÓDIGOS CANJEADOS)
// ================================================

// Actualizar interfaz de usuario
function updateUI() {
    // Actualizar indicador de estado
    if (AppState.dropActive) {
        DOM.statusIndicator.className = 'status-indicator status-active';
        DOM.statusIndicator.innerHTML = '<i class="fas fa-circle"></i> DROP ACTIVO';
        DOM.statusCard.classList.add('drop-active');
        DOM.countdownTitle.textContent = 'DROP finaliza en';
    } else {
        DOM.statusIndicator.className = 'status-indicator status-inactive';
        DOM.statusIndicator.innerHTML = '<i class="fas fa-circle"></i> DROP INACTIVO';
        DOM.statusCard.classList.remove('drop-active');
        DOM.countdownTitle.textContent = 'Próximo DROP en';
    }
    
    // Actualizar códigos disponibles (excluyendo los ya canjeados)
    const availableCodes = AppState.currentCodes.filter(code => 
        !AppState.usedCodes.includes(code) && 
        !AppState.claimedCodes.has(code)
    ).length;
    
    DOM.availableCodes.textContent = availableCodes;
    
    // Actualizar badge de códigos canjeados
    const claimedCount = AppState.usedCodes.length + AppState.claimedCodes.size;
    const claimedBadge = document.getElementById('claimedBadge');
    if (claimedBadge) {
        if (claimedCount > 0) {
            claimedBadge.textContent = `${claimedCount} canjeado${claimedCount !== 1 ? 's' : ''}`;
            claimedBadge.style.display = 'inline-block';
        } else {
            claimedBadge.style.display = 'none';
        }
    }
    
    // Actualizar códigos
    updateCodesDisplay();
    
    // Actualizar información del drop
    updateDropInfo();
    
    // Actualizar próximo drop
    if (AppState.nextDropTime) {
        DOM.nextDrop.textContent = formatDateTime(AppState.nextDropTime);
    }
}

// Actualizar información del drop
function updateDropInfo() {
    if (!AppState.currentDropId) return;
    
    DOM.dropId.textContent = AppState.currentDropId || '---';
    
    if (AppState.dropStartTime) {
        DOM.dropStart.textContent = formatTime(AppState.dropStartTime);
    }
}

// Actualizar visualización de códigos (CON CÓDIGOS CANJEADOS)
function updateCodesDisplay() {
    // Si no hay drop activo, mostrar mensaje específico
    if (!AppState.dropActive) {
        const now = new Date();
        const timeToNextDrop = AppState.nextDropTime ? AppState.nextDropTime - now : 0;
        
        if (timeToNextDrop > 0) {
            const minutes = Math.floor(timeToNextDrop / (1000 * 60));
            DOM.codesContainer.innerHTML = `
                <div class="no-codes-message">
                    <i class="fas fa-hourglass-half"></i>
                    <h3>DROP Finalizado</h3>
                    <p>El drop anterior ha terminado. El próximo drop comenzará en ${minutes} minutos.</p>
                    <p class="small">Los códigos aparecerán automáticamente cuando comience el nuevo drop.</p>
                </div>
            `;
        } else {
            DOM.codesContainer.innerHTML = `
                <div class="no-codes-message">
                    <i class="fas fa-clock"></i>
                    <h3>Esperando nuevo DROP</h3>
                    <p>No hay ningún drop activo en este momento.</p>
                    <p class="small">El administrador debe activar un nuevo drop para generar códigos.</p>
                    <button class="refresh-btn" onclick="updateStatus(true)">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                </div>
            `;
        }
        return;
    }
    
    // Si hay drop activo pero no hay códigos
    if (AppState.currentCodes.length === 0) {
        DOM.codesContainer.innerHTML = `
            <div class="no-codes-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error al cargar códigos</h3>
                <p>No se pudieron cargar los códigos del drop actual.</p>
                <button class="refresh-btn" onclick="updateStatus(true)">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
        return;
    }
    
    // Verificar si todos los códigos están canjeados
    const allCodesClaimed = AppState.currentCodes.every(code => 
        AppState.usedCodes.includes(code) || AppState.claimedCodes.has(code)
    );
    
    if (allCodesClaimed) {
        DOM.codesContainer.innerHTML = `
            <div class="all-codes-claimed">
                <i class="fas fa-trophy"></i>
                <h3>¡Todos los códigos han sido canjeados!</h3>
                <p>Los 3 códigos VIP de este drop ya han sido reclamados por usuarios.</p>
                <p>Espera el próximo drop para tener una nueva oportunidad.</p>
            </div>
        `;
        return;
    }
    
    // Mostrar códigos del drop activo
    const codes = [
        { code: AppState.currentCodes[0], prize: '1000 FICHAS' },
        { code: AppState.currentCodes[1], prize: '10% EXTRA EN FICHAS' },
        { code: AppState.currentCodes[2], prize: '5% EXTRA EN FICHAS' }
    ];
    
    let html = '';
    
    codes.forEach((item, index) => {
        if (!item.code || item.code.trim() === '') return;
        
        const isUsed = AppState.usedCodes.includes(item.code) || AppState.claimedCodes.has(item.code);
        const isClaiming = AppState.redeemingCodes.has(item.code);
        
        html += `
            <div class="code-item ${isUsed ? 'code-used-item' : ''}">
                <div class="code-label">${item.prize}</div>
                <div class="code-value ${isUsed ? 'code-used' : ''} ${isClaiming ? 'code-claiming' : ''}" 
                     onclick="${!isUsed && !isClaiming ? `copyCode('${item.code}')` : ''}"
                     title="${!isUsed && !isClaiming ? 'Haz clic para copiar' : (isUsed ? 'Ya reclamado' : 'En proceso de canje...')}">
                    ${item.code}
                    ${isClaiming ? '<div class="claiming-overlay"><i class="fas fa-spinner fa-spin"></i></div>' : ''}
                </div>
                ${isUsed ? 
                    `<div class="code-status claimed">
                        <i class="fas fa-check-circle"></i> Canjeado
                        <div class="claim-time">Reclamado recientemente</div>
                    </div>` : 
                    (isClaiming ?
                        `<button class="redeem-btn claiming" disabled>
                            <i class="fas fa-spinner fa-spin"></i> Canjeando...
                        </button>` :
                        `<button class="redeem-btn" onclick="redeemCode('${item.code}', ${index})">
                            <i class="fab fa-whatsapp"></i> Canjear Código
                        </button>`
                    )
                }
            </div>
        `;
    });
    
    DOM.codesContainer.innerHTML = html;
}

// Actualizar estado de conexión
function updateConnectionStatus(connected) {
    if (DOM.connectionStatus && DOM.apiStatus) {
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
}

// Actualizar información de administración
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
}

// Actualizar tiempo de última actualización
function updateLastUpdateTime() {
    if (DOM.lastUpdate) {
        const now = new Date();
        DOM.lastUpdate.textContent = formatTime(now);
    }
}

// Actualizar cuenta regresiva
function updateCountdown() {
    const now = new Date();
    
    let targetTime, isDropActive;
    
    if (AppState.dropActive && AppState.dropEndTime) {
        targetTime = AppState.dropEndTime;
        isDropActive = true;
    } else if (AppState.nextDropTime) {
        targetTime = AppState.nextDropTime;
        isDropActive = false;
    } else {
        DOM.timer.textContent = '--:--:--';
        return;
    }
    
    const diff = targetTime - now;
    
    if (diff <= 0) {
        DOM.timer.textContent = '00:00:00';
        
        if (isDropActive) {
            setTimeout(() => updateStatus(true), 1000);
        }
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    DOM.timer.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (isDropActive) {
        if (diff < 60000) {
            DOM.timer.style.color = '#FF5252';
            DOM.timer.style.animation = 'pulse 1s infinite';
        } else if (diff < 300000) {
            DOM.timer.style.color = '#FF9800';
        } else {
            DOM.timer.style.color = '#FFD700';
        }
    } else {
        DOM.timer.style.color = '#2196F3';
    }
}

// ================================================
// 🎯 FUNCIONALIDADES PRINCIPALES - CANJE DE CÓDIGOS
// ================================================

// Función global para canjear código (MEJORADA)
window.redeemCode = async function(code, index) {
    console.log(`Intentando canjear código: ${code}`);
    
    // Validaciones básicas
    if (!code || code.trim() === '') {
        showToast('❌ Código no válido', 'error');
        return;
    }
    
    if (!AppState.dropActive) {
        showToast('❌ El drop no está activo', 'error');
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
    
    if (!AppState.currentCodes.includes(code)) {
        showToast('❌ Código no válido para este drop', 'error');
        return;
    }
    
    // Marcar código como en proceso de canje
    AppState.redeemingCodes.add(code);
    updateCodesDisplay();
    
    try {
        // 1. Copiar código al portapapeles
        const copied = await copyToClipboard(code);
        if (!copied) {
            throw new Error('No se pudo copiar el código');
        }
        
        // 2. Registrar código como usado en la API
        const apiResponse = await callApi('usarCodigo', { codigo: code });
        
        if (apiResponse.exito) {
            // 3. Marcar como canjeado exitosamente
            AppState.redeemingCodes.delete(code);
            AppState.claimedCodes.add(code);
            AppState.usedCodes.push(code);
            AppState.totalUsedCodes++;
            
            // 4. Actualizar UI inmediatamente
            updateUI();
            
            // 5. Mostrar mensaje de éxito
            showToast(`✅ ${apiResponse.mensaje}`, 'success');
            
            // 6. Abrir WhatsApp con el código
            setTimeout(() => {
                openWhatsAppWithCode(code);
            }, 500);
            
            // 7. Actualizar estado general después de 2 segundos
            setTimeout(() => updateStatus(true), 2000);
            
        } else {
            // Error al registrar en API
            AppState.redeemingCodes.delete(code);
            updateCodesDisplay();
            
            showToast(`❌ ${apiResponse.error || 'Error al registrar código'}`, 'error');
        }
        
    } catch (error) {
        console.error('Error en canje:', error);
        
        // Error en el proceso
        AppState.redeemingCodes.delete(code);
        updateCodesDisplay();
        
        showToast('❌ Error al procesar el canje. Intenta nuevamente.', 'error');
    }
};

// Función global para copiar código
window.copyCode = async function(code) {
    if (!code || code.trim() === '') return;
    await copyToClipboard(code);
};

// Copiar al portapapeles
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`✅ Código copiado: ${text}`, 'success');
        return true;
    } catch (err) {
        console.error('Error al copiar:', err);
        
        // Fallback
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
            showToast('No se pudo copiar el código. Intenta manualmente.', 'error');
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

// Abrir WhatsApp con código específico
function openWhatsAppWithCode(code) {
    const message = CONFIG.WHATSAPP_MESSAGE.replace('[CODIGO]', code);
    const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// ================================================
// 🔧 PANEL DE ADMINISTRACIÓN
// ================================================

// Activar nuevo drop
async function activateDrop() {
    const password = DOM.adminPassword.value.trim();
    
    if (!password) {
        showToast('❌ Ingresa la contraseña de administrador', 'error');
        return;
    }
    
    // Deshabilitar botón temporalmente
    DOM.activateDropBtn.disabled = true;
    const originalText = DOM.activateDropBtn.innerHTML;
    DOM.activateDropBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activando...';
    
    try {
        const response = await callApi('activarDrop', { contrasena: password });
        
        if (response.exito) {
            showToast('✅ ' + response.mensaje, 'success');
            DOM.adminPassword.value = '';
            
            // Limpiar códigos reclamados de esta sesión
            AppState.claimedCodes.clear();
            AppState.redeemingCodes.clear();
            
            // Incrementar contador de drops
            AppState.totalDrops++;
            localStorage.setItem('totalDrops', AppState.totalDrops);
            
            // Actualizar estado
            setTimeout(() => updateStatus(true), 1000);
        } else {
            showToast('❌ ' + (response.error || 'Error al activar drop'), 'error');
        }
    } catch (error) {
        console.error('Error al activar drop:', error);
        showToast('❌ Error de conexión con la API', 'error');
    } finally {
        // Restaurar botón
        DOM.activateDropBtn.disabled = false;
        DOM.activateDropBtn.innerHTML = originalText;
    }
}

// Reiniciar sistema
async function resetSystem() {
    const password = DOM.adminPassword.value.trim();
    
    if (!password) {
        showToast('❌ Ingresa la contraseña de administrador', 'error');
        return;
    }
    
    if (!confirm('⚠️ ¿ESTÁS SEGURO DE REINICIAR EL SISTEMA?\n\nEsta acción eliminará TODOS los drops y códigos actuales.\n\nEsta acción NO se puede deshacer.')) {
        return;
    }
    
    // Deshabilitar botón temporalmente
    DOM.resetSystemBtn.disabled = true;
    const originalText = DOM.resetSystemBtn.innerHTML;
    DOM.resetSystemBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reiniciando...';
    
    try {
        const response = await callApi('reiniciar', { contrasena: password });
        
        if (response.exito) {
            showToast('✅ ' + response.mensaje, 'success');
            DOM.adminPassword.value = '';
            
            // Resetear estado local
            AppState.claimedCodes.clear();
            AppState.redeemingCodes.clear();
            AppState.totalDrops = 0;
            AppState.totalUsedCodes = 0;
            localStorage.setItem('totalDrops', '0');
            
            // Actualizar estado
            setTimeout(() => updateStatus(true), 2000);
        } else {
            showToast('❌ ' + (response.error || 'Error al reiniciar sistema'), 'error');
        }
    } catch (error) {
        console.error('Error al reiniciar sistema:', error);
        showToast('❌ Error de conexión con la API', 'error');
    } finally {
        // Restaurar botón
        DOM.resetSystemBtn.disabled = false;
        DOM.resetSystemBtn.innerHTML = originalText;
    }
}

// Verificar estado de la API
async function checkApiStatus() {
    DOM.checkApiBtn.disabled = true;
    const originalText = DOM.checkApiBtn.innerHTML;
    DOM.checkApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    
    try {
        const response = await callApi('saludar');
        
        if (response.exito) {
            showToast('✅ API funcionando correctamente. ' + response.mensaje, 'success');
            updateConnectionStatus(true);
        } else {
            showToast('❌ API no responde correctamente', 'error');
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error('Error al verificar API:', error);
        showToast('❌ No se pudo conectar con la API', 'error');
        updateConnectionStatus('error');
    } finally {
        DOM.checkApiBtn.disabled = false;
        DOM.checkApiBtn.innerHTML = originalText;
    }
}

// Alternar panel de administración
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

// ================================================
// 📱 NOTIFICACIONES (TOAST)
// ================================================

// Mostrar notificación toast
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
    
    // Auto-eliminar después de 5 segundos
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

// ================================================
// 🛠️ FUNCIONES UTILITARIAS
// ================================================

// Formatear fecha y hora completa
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

// Formatear solo hora
function formatTime(date) {
    if (!date || isNaN(date.getTime())) return '--:--:--';
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}

// Detectar cambios en la conexión de red
window.addEventListener('online', () => {
    showToast('🌐 Conexión a internet restablecida', 'success');
    updateStatus(true);
});

window.addEventListener('offline', () => {
    showToast('🌐 Sin conexión a internet', 'error');
    updateConnectionStatus('error');
});

// Auto-actualizar cuando la página vuelve a ser visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        updateStatus(true);
    }
});

// Verificar estado periódicamente
setInterval(() => {
    if (!AppState.apiConnected && AppState.retryCount > 3) {
        updateStatus(true);
    }
}, 30000);
