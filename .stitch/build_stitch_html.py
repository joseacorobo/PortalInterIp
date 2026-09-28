"""
Script generador de HTML Standalone para Stitch
Renderiza el dashboard con Jinja2 (sesión de Coordinador),
embebe todos los estilos de app/static/styles/ y codifica el logo en Base64.
"""
import os
import sys
sys.path.insert(0, os.path.abspath("."))
import re
import base64
from fastapi.testclient import TestClient
import app.main as app_main

def generate_stitch_dashboard():
    client = TestClient(app_main.app)
    
    # Iniciar sesión como Coordinador (Adelis Mejia)
    res_auth = client.post('/api/auth/login', json={
        'username': 'adelis.mejia@inter.com.ve',
        'password': 'inter2026'
    })
    if res_auth.status_code != 200:
        raise RuntimeError(f"Error al autenticar: {res_auth.status_code}")
    
    # Obtener el HTML renderizado por FastAPI / Jinja2
    res_dash = client.get('/')
    if res_dash.status_code != 200:
        raise RuntimeError(f"Error al obtener dashboard: {res_dash.status_code}")
    
    html = res_dash.text
    
    # Leer y consolidar los módulos CSS
    css_files = [
        'app/static/styles/theme_tokens.css',
        'app/static/styles/snow_ui.css',
        'app/static/styles/sidebar_navigation.css',
        'app/static/styles/dashboard_layout.css'
    ]
    bundled_css = []
    for cf in css_files:
        if os.path.exists(cf):
            with open(cf, 'r', encoding='utf-8') as f:
                header = f"/* ==========================================\n   {os.path.basename(cf)}\n   ========================================== */"
                bundled_css.append(f"{header}\n{f.read()}")
    
    combined_css = "\n\n".join(bundled_css)
    css_block = f"<style id=\"stitch-embedded-styles\">\n{combined_css}\n</style>"
    
    # Remover los tags de link a /static/styles/
    link_pattern = re.compile(r'\s*<link rel="stylesheet" href="/static/styles/[^"]+"\s*/>')
    html = link_pattern.sub('', html)
    
    # Insertar el CSS consolidado antes del cierre de </head>
    html = html.replace('</head>', f'{css_block}\n</head>')
    
    # Convertir logo oficial a Base64 data URI para renderizado autónomo
    logo_path = 'app/static/img/inter_logo.png'
    if os.path.exists(logo_path):
        with open(logo_path, 'rb') as lf:
            b64_logo = base64.b64encode(lf.read()).decode('utf-8')
        html = html.replace('/static/img/inter_logo.png', f'data:image/png;base64,{b64_logo}')
    
    # Guardar en .stitch/dashboard_stitch.html
    out_path = os.path.join('.stitch', 'dashboard_stitch.html')
    with open(out_path, 'w', encoding='utf-8') as out_f:
        out_f.write(html)
    
    print(f"[OK] Archivo exportado exitosamente:")
    print(f"     Ruta: {out_path}")
    print(f"     Tamaño: {os.path.getsize(out_path):,} bytes")
    return out_path

if __name__ == '__main__':
    generate_stitch_dashboard()
