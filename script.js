// ================================================
// 🎰 SISTEMA DROP VIP - VERSIÓN 3.1
// CONEXIÓN 100% ESTABLE - DROPS AUTOMÁTICOS
// ================================================

// CONFIGURACIÓN - ¡REEMPLAZA ESTOS VALORES!
const CONFIG = {
    // ⚠️ ¡IMPORTANTE! Reemplaza con la URL de tu Web App de Google Apps Script
    API_URL: 'https://script.google.com/macros/s/AKfycbxLiv7YM-oBrWnWhZz-BKYvPgrSOeVF6vxhTA-akLzzvHLP_EuBtU7hjsGlVfqZreTU4Q/exec',
    
    // Configuración del sistema
    UPDATE_INTERVAL: 5000, // 5 segundos (más frecuente para detectar cambios)
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
    usedCodes: [],
    adminPanelVisible: false,
    currentCodes: [],
    currentDropId: null,
    dropStartTime: null,
    apiConnected: false,
    lastUpdate: null,
    retryCount: 0,
    isUpdating: false,
    connectionRetryTimer: null,
    totalDrops: 0,
    totalUsedCodes: 0,
    lastAction: null
};

// CACHE DE ELEMENTOS DOM
const DOM = {};

// ================================================
// 📦 INICIALIZACIÓN
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎰 Sistema DROP VIP v3.1 inicializando...');
    
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
        updateStatus(true); // Forzar actualización
        showToast('🔄 Actualización forzada', 'info');
    });
    
    // Limpiar temporizadores al salir de la página
    window.addEventListener('beforeunload', () => {
        if (AppState.connectionRetryTimer) {
            clearTimeout(AppState.connectionRetryTimer);
        }
    });
    
    // Detectar visibilidad de la página
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // La página se volvió visible, actualizar estado
            updateStatus(true);
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
    
    // Iniciar actualización periódica
    setInterval(() => updateStatus(false), CONFIG.UPDATE_INTERVAL);
}

// Cargar datos iniciales
function loadInitialData() {
    showToast('Conectando con el servidor...', 'info');
    updateStatus(true); // Forzar actualización inicial
}

// ================================================
// 🔄 ACTUALIZACIÓN DEL ESTADO (MEJORADA)
// ================================================

// Actualizar estado del drop
async function updateStatus(force = false) {
    // Evitar múltiples actualizaciones simultáneas
    if (AppState.isUpdating && !force) return;
    
    AppState.isUpdating = true;
    
    try {
        console.log('🔄 Actualizando estado del DROP...');
        const data = await callApi('estado');
        
        if (data && data.exito) {
            processApiResponse(data);
            updateConnectionStatus(true);
            updateLastUpdateTime();
            AppState.retryCount = 0;
            
            // Verificar si necesitamos un nuevo drop
            checkForNewDrop(data);
            
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
    updateUI(data);
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

// Verificar si necesitamos un nuevo drop
function checkForNewDrop(data) {
    const now = new Date();
    const dropEndTime = new Date(data.tiempoRestante);
    const nextDropTime = new Date(data.proximoDrop);
    
    // Si el drop terminó pero aún no hay próximo drop programado
    if (!AppState.dropActive && nextDropTime < now) {
        console.log('⚠️ El drop terminó pero no hay próximo drop programado');
        
        // Mostrar mensaje especial
        DOM.codesContainer.innerHTML = `
            <div class="no-codes-message">
                <i class="fas fa-clock"></i>
                <h3>Esperando nuevo DROP</h3>
                <p>El drop anterior ha terminado. El sistema está esperando que se active un nuevo drop.</p>
                <button class="refresh-btn" onclick="updateStatus(true)">
                    <i class="fas fa-sync-alt"></i> Actualizar
                </button>
            </div>
        `;
    }
}

// Manejar errores de API
function handleApiError(error) {
    console.error('❌ Error en la API:', error);
    
    AppState.retryCount++;
    
    if (AppState.retryCount <= 3) {
        showToast(`Reintentando conexión (${AppState.retryCount}/3)...`, 'warning');
        updateConnectionStatus(false);
        
        // Intentar reconexión después de un tiempo
        clearTimeout(AppState.connectionRetryTimer);
        AppState.connectionRetryTimer = setTimeout(() => {
            updateStatus(true);
        }, 3000);
    } else {
        showToast('Error de conexión persistente. Verifica tu internet.', 'error');
        updateConnectionStatus('error');
        
        // Resetear contador después de 30 segundos
        setTimeout(() => {
            AppState.retryCount = 0;
        }, 30000);
    }
}

// ================================================
// 🌐 CONEXIÓN CON LA API (OPTIMIZADA)
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
    
    console.log(`📡 Llamando a API: ${action}`);
    
    try {
        // Intentar con fetch directo
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
            // Método alternativo con proxy
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
// 🎨 INTERFAZ DE USUARIO (MEJORADA)
// ================================================

// Actualizar interfaz de usuario
function updateUI(data) {
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
    
    // Actualizar códigos disponibles
    const availableCount = data.codigosDisponibles || 0;
    DOM.availableCodes.textContent = availableCount;
    
    // Actualizar códigos
    updateCodesDisplay(data.datosDrop);
    
    // Actualizar información del drop
    updateDropInfo(data.datosDrop);
    
    // Actualizar próximo drop
    if (AppState.nextDropTime) {
        DOM.nextDrop.textContent = formatDateTime(AppState.nextDropTime);
    }
}

// Actualizar información del drop
function updateDropInfo(dropData) {
    if (!dropData) return;
    
    DOM.dropId.textContent = dropData.idDrop || '---';
    
    if (dropData.horaInicio) {
        const startTime = new Date(dropData.horaInicio);
        DOM.dropStart.textContent = formatTime(startTime);
    }
}

// Actualizar visualización de códigos (CORREGIDA)
function updateCodesDisplay(dropData) {
    // Si no hay drop activo, mostrar mensaje específico
    if (!AppState.dropActive) {
        const now = new Date();
        const timeToNextDrop = AppState.nextDropTime ? AppState.nextDropTime - now : 0;
        
        if (timeToNextDrop > 0) {
            // Hay próximo drop programado
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
            // No hay drop programado
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
    
    // Si hay drop activo pero no hay datos
    if (!dropData) {
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
    
    // Mostrar códigos del drop activo
    const codes = [
        { code: dropData.codigo1, prize: '1000 FICHAS' },
        { code: dropData.codigo2, prize: '10% EXTRA EN FICHAS' },
        { code: dropData.codigo3, prize: '5% EXTRA EN FICHAS' }
    ];
    
    let html = '';
    let validCodesCount = 0;
    
    codes.forEach((item) => {
        const isUsed = AppState.usedCodes.includes(item.code);
        const hasCode = item.code && item.code.trim() !== '';
        
        if (hasCode) validCodesCount++;
        
        html += `
            <div class="code-item ${!hasCode ? 'code-expired' : ''}">
                <div class="code-label">${item.prize}</div>
                <div class="code-value ${isUsed ? 'code-used' : ''} ${!hasCode ? 'code-expired' : ''}" 
                     onclick="${hasCode && !isUsed ? `copyCode('${item.code}')` : ''}"
                     title="${hasCode && !isUsed ? 'Haz clic para copiar' : (isUsed ? 'Ya reclamado' : 'No disponible')}">
                    ${item.code || '--------'}
                </div>
                ${isUsed ? 
                    '<div class="code-status"><i class="fas fa-check-circle"></i> Reclamado</div>' : 
                    (hasCode ? 
                        `<button class="redeem-btn" onclick="redeemCode('${item.code}')">
                            <i class="fab fa-whatsapp"></i> Canjear Código
                        </button>` : 
                        '<div class="code-status">No disponible</div>'
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
        DOM.totalUsedCodes.textContent = AppState.totalUsedCodes;
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

// Actualizar cuenta regresiva (MEJORADA)
function updateCountdown() {
    const now = new Date();
    
    // Determinar qué tiempo mostrar
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
    
    // Si el tiempo ha expirado
    if (diff <= 0) {
        DOM.timer.textContent = '00:00:00';
        
        // Si era un drop activo que terminó, actualizar estado
        if (isDropActive) {
            // Forzar actualización para obtener nuevo estado
            setTimeout(() => updateStatus(true), 1000);
        }
        return;
    }
    
    // Calcular horas, minutos, segundos
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    DOM.timer.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Cambiar color según el tiempo restante
    if (isDropActive) {
        if (diff < 60000) { // Menos de 1 minuto
            DOM.timer.style.color = '#FF5252';
            DOM.timer.style.animation = 'pulse 1s infinite';
        } else if (diff < 300000) { // Menos de 5 minutos
            DOM.timer.style.color = '#FF9800';
        } else {
            DOM.timer.style.color = '#FFD700';
        }
    } else {
        DOM.timer.style.color = '#2196F3';
    }
}

// ================================================
// 🎯 FUNCIONALIDADES PRINCIPALES
// ================================================

// Función global para canjear código
window.redeemCode = async function(code) {
    if (!code || code.trim() === '') {
        showToast('❌ Código no válido', 'error');
        return;
    }
    
    // Verificar si el drop está activo
    if (!AppState.dropActive) {
        showToast('❌ El drop no está activo', 'error');
        return;
    }
    
    // Verificar si el código está usado
    if (AppState.usedCodes.includes(code)) {
        showToast('❌ Este código ya fue reclamado', 'error');
        return;
    }
    
    // Verificar si el código existe en los actuales
    if (!AppState.currentCodes.includes(code)) {
        showToast('❌ Código no válido para este drop', 'error');
        return;
    }
    
    // Copiar al portapapeles
    await copyToClipboard(code);
    
    // Abrir WhatsApp
    openWhatsAppWithCode(code);
    
    // Registrar uso local
    AppState.usedCodes.push(code);
    AppState.totalUsedCodes = AppState.usedCodes.length;
    updateAdminInfo();
    
    // Actualizar UI
    updateStatus(true);
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
        } catch (copyError) {
            showToast('No se pudo copiar el código. Intenta manualmente.', 'error');
        }
        
        document.body.removeChild(textArea);
    }
}

// Abrir WhatsApp con código específico
function openWhatsAppWithCode(code) {
    const message = CONFIG.WHATSAPP_MESSAGE.replace('[CODIGO]', code);
    const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

// ================================================
// 🔧 PANEL DE ADMINISTRACIÓN (MEJORADO)
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
            
            // Incrementar contador de drops
            AppState.totalDrops++;
            localStorage.setItem('totalDrops', AppState.totalDrops);
            
            // Actualizar estado después de 1 segundo
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
            
            // Resetear estadísticas locales
            AppState.totalDrops = 0;
            localStorage.setItem('totalDrops', '0');
            
            // Actualizar estado después de 2 segundos
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
        // La pestaña se hizo visible, actualizar datos
        updateStatus(true);
    }
});

// Verificar estado periódicamente incluso si hay errores
setInterval(() => {
    if (!AppState.apiConnected && AppState.retryCount > 3) {
        // Intentar reconexión después de 30 segundos de error
        updateStatus(true);
    }
}, 30000);