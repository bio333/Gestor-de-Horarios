// public/login/login.js

let selectedRole = null;

function clearRoleButtons() {
    document.getElementById("btn-sub").classList.remove("btn-role-active");
    document.getElementById("btn-jefe").classList.remove("btn-role-active");
    document.getElementById("btn-maestro").classList.remove("btn-role-active");
}

function selectRole(rol) {
    selectedRole = rol;
    clearRoleButtons();

    if (rol === 'subdirector') document.getElementById("btn-sub").classList.add("btn-role-active");
    if (rol === 'jefe')        document.getElementById("btn-jefe").classList.add("btn-role-active");
    if (rol === 'maestro')     document.getElementById("btn-maestro").classList.add("btn-role-active");

    const msg = document.getElementById("msg");
    msg.innerHTML = `<div class="alert alert-info py-1 mb-0">
        Rol seleccionado: <strong>${rol}</strong>
    </div>`;
}

// Validación Bootstrap + login
const form = document.getElementById('loginForm');
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Validación visual Bootstrap
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");

    msg.innerHTML = `<div class="alert alert-secondary py-1 mb-0">Verificando credenciales...</div>`;

    try {
        const res = await fetch("http://localhost:3000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok && data.mensaje === "Login exitoso") {
            msg.innerHTML = `<div class="alert alert-success py-1 mb-0">
                Bienvenido <strong>${data.username}</strong>. Rol detectado: <strong>${data.rol}</strong>
            </div>`;

            // 🔹 Guardar info básica del usuario para el front (maestro usa esto)
            try {
                console.log('Respuesta de login:', data);

                const usuario = {
                    // Usa el id que te mande tu backend (docente_id, id, userId, etc.)
                    id: data.docente_id || data.id || data.userId || data.usuario_id,
                    rol: (data.rol || '').toUpperCase(),   // SUBDIRECTOR / JEFE / MAESTRO
                    nombre: data.username || ''
                };

                localStorage.setItem('usuario', JSON.stringify(usuario));
                console.log('Usuario guardado en localStorage:', usuario);
            } catch (e2) {
                console.error('No se pudo guardar usuario en localStorage:', e2);
            }

            // Redirigir según rol
            setTimeout(() => {
                if (data.rol === 'subdirector') {
                    window.location.href = '/subdirector/menu.html';
                } else if (data.rol === 'maestro') {
                    window.location.href = '/maestro/menu.html';
                } else if (data.rol === 'jefe') {
                    window.location.href = '/jefe/menu.html';
                }
            }, 800);
        } else {
            msg.innerHTML = `<div class="alert alert-danger py-1 mb-0">
                ${data.mensaje || 'Error al iniciar sesión'}
            </div>`;
        }
    } catch (error) {
        console.error(error);
        msg.innerHTML = `<div class="alert alert-danger py-1 mb-0">
            Error de conexión con el servidor.
        </div>`;
    }
});
