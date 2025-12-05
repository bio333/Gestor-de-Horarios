function abrirSeccion(seccion) {
    const panel = document.getElementById('panel-estado');

    const textos = {
        'maestros-agregar': 'Abriste: Agregar maestro. (Luego aquí pondremos el formulario conectado a la API de maestros).',
        'maestros-ver': 'Abriste: Ver / editar maestros. (Aquí listaremos los 15 maestros y sus horas).',
        'materias-agregar': 'Abriste: Agregar materia. (Formulario para nuevas materias con créditos y semestre).',
        'materias-ver': 'Abriste: Ver / editar materias. (Tabla con todas las materias por semestre).',
        'edificios-ver': 'Abriste: Ver edificios y salones. (R1, R2, P con sus aulas).',
        'salones-disponibles': 'Abriste: Ver horarios ocupados de un salón. (Selector de edificio + salón + horarios).',
        'horarios-auto': 'Abriste: Generar horario automático. (Usará el algoritmo con reglas de créditos y recesos).',
        'horarios-editar': 'Abriste: Editar horarios manualmente. (Vista tipo calendario).',
        'grupos-agregar': 'Abriste: Agregar grupo. (Semestre, grupo, número de alumnos).',
        'grupos-ver': 'Abriste: Ver / editar grupos. (Listado de todos los grupos).'
    };

    panel.className = 'alert alert-info p-2 small';
    panel.textContent = textos[seccion] || 'Sección seleccionada.';
}

function logout() {
    // Más adelante limpiaremos token / sesión
    window.location.href = '/login/index.html';
}
