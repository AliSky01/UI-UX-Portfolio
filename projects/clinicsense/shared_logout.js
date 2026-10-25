// Helper function to get the correct relative path from any subdirectory
function getBasePath() {
    // Get the current pathname and split by directories
    const pathname = window.location.pathname;
    const pathParts = pathname.split('/').filter(p => p.length > 0);
    
    // Remove the filename (last part)
    pathParts.pop();
    
    // Check if we're in a subdirectory like /admin, /doctor, /nurse, /finance, /patient, /receptionist, /registration
    const knownSubdirs = ['admin', 'doctor', 'nurse', 'finance', 'patient', 'receptionist', 'registration'];
    if (pathParts.length > 0 && knownSubdirs.includes(pathParts[pathParts.length - 1])) {
        return '../'; // Go up one level from subdirectory
    }
    return './'; // Stay in root or handle accordingly
}

// Shared helper: fetch current logged-in user from the server
async function fetchCurrentUser() {
    try {
        const basePath = getBasePath();
        const url = new URL(basePath + 'php/get_user.php', window.location.href).href;
        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || `HTTP ${response.status}`);
        }

        return data.user || null;
    } catch (error) {
        console.error('Failed to fetch current user:', error);
        return null;
    }
}

// Load user info and update header
async function loadUserInfo() {
    const user = await fetchCurrentUser();

    const headerName     = document.getElementById('headerName');
    const headerUserName = document.getElementById('headerUserName');
    const welcomeName    = document.getElementById('welcomeName');

    const fullName = user ? `${user.firstname || ''} ${user.lastname || ''}`.trim() : '';

    if (headerName)     headerName.textContent     = fullName || 'Guest';
    if (headerUserName) headerUserName.textContent = fullName || 'Guest';
    if (welcomeName)    welcomeName.textContent    = user?.firstname || 'Guest';
}

// Perform logout
async function performLogout() {
    const basePath = getBasePath();
    try {
        const url = new URL(basePath + 'php/logout.php', window.location.href).href;
        await fetch(url, { method: 'POST', credentials: 'include' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    // Redirect to login page
    window.location.href = basePath + 'registration/Login1stpage.html';
}

// Logout handler for elements with id="logoutBtn"
function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            await performLogout();
        });
    }
}

// Logout handler for all elements with class="logout-link"
function attachLogoutLinkHandlers() {
    const logoutLinks = document.querySelectorAll('.logout-link');
    logoutLinks.forEach(link => {
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            await performLogout();
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUserInfo();
    initLogout();
    attachLogoutLinkHandlers();
});