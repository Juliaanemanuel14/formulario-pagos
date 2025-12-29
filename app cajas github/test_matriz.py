"""
Script de prueba para el reporte matricial
"""
from datetime import date, timedelta
import sys
sys.path.insert(0, 'app_de_cajas')

from app import _build_remesas_matrix_report

# Probar con una fecha simple
hoy = date.today()
print(f"Probando reporte para: {hoy}")

try:
    resultado = _build_remesas_matrix_report(hoy, hoy)
    print("\n✅ Reporte generado exitosamente!")
    print(f"\nFechas: {resultado['fechas']}")
    print(f"Locales: {resultado['locales'][:3]}...")  # Mostrar solo los primeros 3
    print(f"\nEjemplo de datos de matriz:")

    if resultado['locales']:
        primer_local = resultado['locales'][0]
        for fecha in resultado['fechas']:
            datos = resultado['matriz'][primer_local][fecha]
            print(f"\n{primer_local} - {fecha}:")
            print(f"  Teórico: ${datos['teorico']:.2f}")
            print(f"  Real: ${datos['real']:.2f}")
            print(f"  Estado: {datos['estado']}")
            print(f"  Remesas: {len(datos['remesas'])}")

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    print(traceback.format_exc())
