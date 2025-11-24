# 🎨 Guía de Experimentación con Colores y Gradientes

## 📍 Dónde Experimentar

### **Archivo Principal: `ktown_webapp/client/src/colorGradients.js`**

Este es el archivo donde puedes experimentar con todos los colores y gradientes. Todo está claramente marcado con comentarios `// EXPERIMENT:`.

---

## 🎯 Sistema de Hotspots (Intensidad de Información)

El sistema calcula la "intensidad" de información de cada celda basándose en:
- **Sites** (sitios)
- **Structures** (estructuras)
- **Historical Figures** (figuras históricas)
- **Underground Regions** (regiones subterráneas)
- **Written Contents** (libros/contenido escrito)

**Más información = color más intenso = hotspot más visible**

---

## 🔧 Configuraciones que Puedes Cambiar

### 1. **Pesos de Información** (Líneas ~20-30)

```javascript
const WEIGHTS = {
  sites: 0.3,           // Cambia esto para dar más/menos peso a sitios
  structures: 0.25,     // Cambia esto para estructuras
  figures: 0.2,        // Cambia esto para figuras históricas
  undergroundRegions: 0.15, // Cambia esto para regiones subterráneas
  writtenContents: 0.1, // Cambia esto para libros
};
```

**Ejemplo:** Si quieres que los sitios sean más importantes:
```javascript
sites: 0.5,  // Aumenta de 0.3 a 0.5
```

---

### 2. **Curva de Intensidad** (Línea ~40)

```javascript
const intensityCurve = 1.5; // EXPERIMENT: Cambia esto
```

- **1.0** = Lineal (suave)
- **< 1.0** = Más suave (hotspots menos intensos)
- **> 1.0** = Más agresivo (hotspots más intensos)

**Ejemplo:** Para hotspots más dramáticos:
```javascript
const intensityCurve = 2.0; // Más agresivo
```

---

### 3. **Colores Base** (Líneas ~50-70)

Colores para cada tipo de región cuando tienen **poca información** (intensidad baja):

```javascript
baseColors: {
  "Grassland": [220, 240, 150],   // RGB: Verde claro
  "Desert": [250, 240, 180],      // RGB: Beige claro
  "Forest": [180, 210, 130],      // RGB: Verde medio
  // ... etc
}
```

**Ejemplo:** Para hacer Grassland más azul:
```javascript
"Grassland": [200, 220, 250],  // Más azul
```

---

### 4. **Colores Hotspot** (Líneas ~75-95)

Colores para cada tipo de región cuando tienen **mucha información** (intensidad alta):

```javascript
hotspotColors: {
  "Grassland": [255, 200, 100],   // RGB: Naranja-amarillo brillante
  "Desert": [255, 180, 80],       // RGB: Naranja brillante
  "Forest": [100, 255, 120],      // RGB: Verde brillante
  // ... etc
}
```

**Ejemplo:** Para hotspots rojos en Grassland:
```javascript
"Grassland": [255, 100, 100],  // Rojo brillante
```

---

### 5. **Curva de Gradiente** (Línea ~100)

```javascript
intensityCurve: 1.2,  // EXPERIMENT: Cambia esto
```

Controla qué tan suave es la transición entre color base y hotspot:
- **1.0** = Transición lineal
- **< 1.0** = Transición más suave
- **> 1.0** = Transición más abrupta (hotspots más definidos)

---

### 6. **Umbral Mínimo de Intensidad** (Línea ~105)

```javascript
minIntensityThreshold: 0.0,  // EXPERIMENT: Cambia esto
```

- **0.0** = Siempre usa gradientes (incluso con poca información)
- **0.3** = Solo muestra hotspots cuando hay bastante información
- **0.5** = Solo hotspots muy intensos

**Ejemplo:** Para solo mostrar hotspots muy intensos:
```javascript
minIntensityThreshold: 0.4,
```

---

## 🎨 Ejemplos de Experimentación

### Ejemplo 1: Hotspots Rojos Dramáticos

```javascript
// En colorGradients.js

hotspotColors: {
  "Grassland": [255, 50, 50],    // Rojo brillante
  "Desert": [255, 80, 80],       // Rojo claro
  "Forest": [200, 50, 50],       // Rojo oscuro
  // ... etc
},

intensityCurve: 2.0,  // Más agresivo
minIntensityThreshold: 0.2,  // Solo hotspots intensos
```

### Ejemplo 2: Gradientes Suaves y Sutiles

```javascript
hotspotColors: {
  "Grassland": [240, 220, 180],  // Solo un poco más intenso
  // ... colores más cercanos a baseColors
},

intensityCurve: 0.8,  // Más suave
minIntensityThreshold: 0.0,  // Siempre usa gradientes
```

### Ejemplo 3: Hotspots Azules/Cyan

```javascript
hotspotColors: {
  "Grassland": [100, 200, 255],  // Azul brillante
  "Desert": [150, 220, 255],     // Cyan brillante
  "Forest": [80, 180, 255],      // Azul oscuro
  // ... etc
},
```

---

## 🔄 Cómo Aplicar Cambios

1. **Edita** `ktown_webapp/client/src/colorGradients.js`
2. **Guarda** el archivo
3. **Recarga** el navegador (el mapa se actualizará automáticamente)

---

## 📊 Cómo Funciona

1. **Cálculo de Intensidad:**
   - Cuenta información en la celda (sites, structures, etc.)
   - Aplica pesos para cada tipo
   - Normaliza a 0.0-1.0

2. **Interpolación de Color:**
   - Intensidad 0.0 = Color base (poca información)
   - Intensidad 1.0 = Color hotspot (mucha información)
   - Valores intermedios = Gradiente suave

3. **Aplicación:**
   - Mapa principal: Usa en texturas generadas
   - Minimap: Usa directamente como color RGB

---

## 💡 Tips

- **Empieza con cambios pequeños** - ajusta un valor a la vez
- **Prueba diferentes combinaciones** de `intensityCurve` y `minIntensityThreshold`
- **Los colores RGB van de 0-255** - valores más altos = más brillante
- **Hotspots más intensos** = más fácil ver dónde hay información importante
- **Gradientes suaves** = aspecto más sutil y elegante

---

## 🎯 Archivos Relacionados

- **`colorGradients.js`** - ⭐ **AQUÍ EXPERIMENTAS** - Configuración de colores y gradientes
- **`proceduralTextures.js`** - Generación de texturas (usa colorGradients)
- **`worldMap.js`** - Renderizado del mapa principal (usa texturas con gradientes)
- **`Minimap.js`** - Renderizado del minimap (usa colorGradients directamente)

---

¡Diviértete experimentando! 🎨

