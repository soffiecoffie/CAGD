// Библиотека WebGL-FMI v0.16.05Ex
//
// Работа с контексти и шейдъри
//		getContext(id)
//		getShader(id,type)
//		getProgram(idv,idf)
//		getVariables()
//
// Математически и помощни функции и константи
//		sin(a)
//		cos(a)
//		PI
//		custom(obj,props)
//
// Работа с вектори и матрици
//		vectorProduct(x,y)
//		scalarProduct(x,y)
//		vectorPoints(x,y)
//
// Трансформации със съставни матрици
//		identity()
//		translate(v)
//		scale(v)
//		useMatrix()
//		pushMatrix()
//		popMatrix()
//
// Проектиране с матрици
//		viewMatrix (eye, focus, up)
//		orthoMatrix(width, height, near, far)
//		lookAt(eye, focus, up)

// Създаване на Crossplot
//		CoordinateSystem(xLeft, xRight, yBottom, yTop)
//		Circle(x, y)
//		Grid()
//		BezierCurve(controlPoints, drawContour)
//		Letter(center, letter)
//		getX(event)
//		getY(event)

var gl; // глобален WebGL контекст
var glprog; // глобална GLSL програма
var glmat; // глобална матрица на модела
var glmatnew; // true, ако матрицата е променена, но не е подадена на шейдъра
var glvmat; // глобална матрица на гледната точка
var glstack = []; // стек от матрици на модела

// брой байтове в един WebGL FLOAT (трябва да са 4 байта)
var FLOATS = Float32Array.BYTES_PER_ELEMENT;

// връща WebGL контекст, свързан с HTML елемент с даден id
function getContext(id) {
  var canvas = document.getElementById(id);
  if (!canvas) {
    alert('Искаме canvas с id="' + id + '", а няма!');
    return null;
  }

  var context = canvas.getContext("webgl");
  if (!context) {
    context = canvas.getContext("experimental-webgl");
  }

  if (!context) {
    alert("Искаме WebGL контекст, а няма!");
  }

  return context;
}

// връща компилиран шейдър
function getShader(id, type) {
  var elem = document.getElementById(id);
  var source = elem ? elem.text : id;
  var shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

// връща готова програма
function getProgram(idv, idf) {
  var vShader = getShader(idv, gl.VERTEX_SHADER);
  var fShader = getShader(idf, gl.FRAGMENT_SHADER);

  if (!vShader || !fShader) {
    return null;
  }

  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vShader);
  gl.attachShader(shaderProgram, fShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  gl.useProgram(shaderProgram);
  return shaderProgram;
}

// намира адресите на всички глобални и атрибутни променливи
function getVariables() {
  for (var i = 0; i < gl.getProgramParameter(glprog, gl.ACTIVE_UNIFORMS); i++) {
    var name = gl.getActiveUniform(glprog, i).name;
    window[name] = gl.getUniformLocation(glprog, name);
  }

  for (
    var i = 0;
    i < gl.getProgramParameter(glprog, gl.ACTIVE_ATTRIBUTES);
    i++
  ) {
    var name = gl.getActiveAttrib(glprog, i).name;
    window[name] = gl.getAttribLocation(glprog, name);
  }
}

// синус
function sin(a) {
  return Math.sin(a);
}

// косинус
function cos(a) {
  return Math.cos(a);
}

// пи
var PI = Math.PI;

// създава матрица за ортографска проекция
function orthoMatrix(width, height, near, far) {
  var matrix = [
    2.0 / width,
    0,
    0,
    0,
    0,
    2.0 / height,
    0,
    0,
    0,
    0,
    2.0 / (near - far),
    0,
    0,
    0,
    (far + near) / (near - far),
    1,
  ];
  return new Float32Array(matrix);
}

// единичен вектор
function unitVector(x) {
  var len = 1 / Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
  return [len * x[0], len * x[1], len * x[2]];
}

// векторно произведение на два вектора
function vectorProduct(x, y) {
  return [
    x[1] * y[2] - x[2] * y[1],
    x[2] * y[0] - x[0] * y[2],
    x[0] * y[1] - x[1] * y[0],
  ];
}

// скаларно произведение на два вектора
function scalarProduct(x, y) {
  return x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
}

// вектор между две точки
function vectorPoints(x, y) {
  return [x[0] - y[0], x[1] - y[1], x[2] - y[2]];
}

// генерира матрица за гледна точка, параметрите са масиви с по 3 елемента
function viewMatrix(eye, focus, up) {
  // единичен вектор Z' по посоката на гледане
  var z = unitVector(vectorPoints(eye, focus));

  // единичен вектор X', перпендикулярен на Z' и на посоката нагоре
  var x = unitVector(vectorProduct(up, z));

  // единичен вектор Y', перпендикулярен на X' и Z'
  var y = unitVector(vectorProduct(z, x));

  // резултатът е тези три вектора + транслация
  var matrix = [
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
    -scalarProduct(x, eye),
    -scalarProduct(y, eye),
    -scalarProduct(z, eye),
    1,
  ];
  return new Float32Array(matrix);
}

// установява гледна точка
function lookAt(eye, target, up) {
  glvmat = viewMatrix(eye, target, up);
  gl.uniformMatrix4fv(uViewMatrix, false, glvmat);
}

// зарежда единичната матрица в матрицата на модела
function identity() {
  glmatnew = true;
  glmat = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

// добавя транслация към матрицата на модела
function translate(v) {
  glmatnew = true;
  glmat[12] += glmat[0] * v[0] + glmat[4] * v[1] + glmat[8] * v[2];
  glmat[13] += glmat[1] * v[0] + glmat[5] * v[1] + glmat[9] * v[2];
  glmat[14] += glmat[2] * v[0] + glmat[6] * v[1] + glmat[10] * v[2];
}

// добавя мащабиране към матрицата на модела
function scale(v) {
  glmatnew = true;
  glmat[0] *= v[0];
  glmat[1] *= v[0];
  glmat[2] *= v[0];

  glmat[4] *= v[1];
  glmat[5] *= v[1];
  glmat[6] *= v[1];

  glmat[8] *= v[2];
  glmat[9] *= v[2];
  glmat[10] *= v[2];
}

// ако матрицата на модела е променена, изпраща я към шейдъра
function useMatrix() {
  if (glmatnew) {
    glmatnew = false;
    gl.uniformMatrix4fv(uModelMatrix, false, glmat);
  }
}

// добавя текущата матрица на модела в стека за матрици
function pushMatrix() {
  var mat = new Float32Array(glmat.length);
  mat.set(glmat);
  glstack.push(mat);
}

// извлича матрица на модела от стека за матрици
// при празен стек връща единичната матрица
function popMatrix() {
  glmatnew = true;
  if (glstack.length) glmat = glstack.pop();
  else identity();
}





// Координатна система
CoordinateSystem = function (xLeft, xRight, yBottom, yTop) {
  var data = [];

  //абсцисата
  data.push(xLeft, 0, 0);
  data.push(xRight, 0, 0);

  //ордината
  data.push(0, yBottom, 0);
  data.push(0, yTop, 0);

  //връхчетата на стрелките
  // по X
  data.push(xLeft, 6, 0);
  data.push(xLeft, -6, 0);
  data.push(xLeft - 10, 0, 0);
  data.push(xRight, 6, 0);
  data.push(xRight, -6, 0);
  data.push(xRight + 10, 0, 0);

  //по Y
  data.push(6, yBottom, 0);
  data.push(-6, yBottom, 0);
  data.push(0, yBottom - 10, 0);
  data.push(-6, yTop, 0);
  data.push(6, yTop, 0);
  data.push(0, yTop + 10, 0);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); 
  this.color = [0.6, 0.73, 0.8];
  this.buf = buf;
  this.scale = [1, 1, 1];
  this.center = [0, 0, 0];
};

// Координатна система - метод за рисуване
CoordinateSystem.prototype.draw = function () {
  pushMatrix();
  gl.vertexAttrib3fv(aColor, this.color);
  translate(this.center);
  scale(this.scale);
  useMatrix();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
  gl.enableVertexAttribArray(aXYZ);
  gl.vertexAttribPointer(aXYZ, 3, gl.FLOAT, false, 3 * FLOATS, 0 * FLOATS);
  gl.drawArrays(gl.LINE_STRIP, 0, 2);
  gl.drawArrays(gl.LINE_STRIP, 2, 2);
  for (var i = 0; i < 4; i++) gl.drawArrays(gl.TRIANGLES, 4 + i * 3, 3);

  popMatrix();
};

// Окръжност
Circle = function (x, y) {
  this.n = 25;
  var data = [0, 0, 0];
  for (var i = 0; i <= this.n; i++) {
    var a = (2 * PI * i) / this.n;
    data.push(cos(a), sin(a), 0);
  }
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  this.buf = buf;
  this.color = [0, 0, 0];
  this.scale = [5, 5, 0];
  this.center = [x, y, 0];
};

// Окръжност - метод за рисуване
Circle.prototype.draw = function () {
  pushMatrix();
  gl.vertexAttrib3fv(aColor, this.color);
  translate(this.center);
  scale(this.scale);
  useMatrix();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
  gl.enableVertexAttribArray(aXYZ);
  gl.vertexAttribPointer(aXYZ, 3, gl.FLOAT, false, 3 * FLOATS, 0 * FLOATS);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, this.n + 2);
  popMatrix();
};

// Координатна мрежа
Grid = function () {
  var data = [];

  // хоризонтални линии
  for (var i = 0; i < 40; i++) {
	data.push(-270, 400 - i * 20, 0);
    data.push(270, 400 - i * 20, 0);
  }

  // вертикални линии
  for (var i = 0; i < 40; i++) {
    data.push(400 - i * 20, 320, 0);
    data.push(400 - i * 20, -320, 0);
  }

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); 
  this.color = [0.85, 0.85, 0.9];

  this.buf = buf;
  this.scale = [1, 1, 1];
  this.center = [0, 0, 0];
};

// Координатна мрежа - метод за рисуване
Grid.prototype.draw = function () {
  pushMatrix();
  gl.vertexAttrib3fv(aColor, this.color);
  translate(this.center);
  scale(this.scale);
  useMatrix();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
  gl.enableVertexAttribArray(aXYZ);
  gl.vertexAttribPointer(aXYZ, 3, gl.FLOAT, false, 3 * FLOATS, 0 * FLOATS);
  gl.drawArrays(gl.LINES, 0, 2 * 39);
  gl.drawArrays(gl.LINES, 2 * 39, 2 * 39);

  popMatrix();
};

// крива на Безие
function BezierCurve(controlPoints, drawContour) {
  var data = [];
  var b = [];
  var n = controlPoints.length;

  // първата точка на кривата съвпада с първата контролна точка
  if (n > 0) {
    data.push(controlPoints[0].center[0]);
    data.push(controlPoints[0].center[1]);
    data.push(0);
  }

  var step = 100; // нова точка през 0.01

  //de Casteljau
  for (var t = 0; t < step - 1; t++) {
    b.push([]);
    for (var r = 0; r < n; r++) {
      b[t].push([]);
      for (var i = 0; i < n - r; i++) {
        b[t][r].push([]);
        if (r == 0) {
          b[t][r][i].push(controlPoints[i].center[0]);
          b[t][r][i].push(controlPoints[i].center[1]);
        } else {
          b[t][r][i].push(
            (1 - (t + 1) / step) * b[t][r - 1][i][0] +
              ((t + 1) / step) * b[t][r - 1][i + 1][0]
          );
          b[t][r][i].push(
            (1 - (t + 1) / step) * b[t][r - 1][i][1] +
              ((t + 1) / step) * b[t][r - 1][i + 1][1]
          );
        }
        if (r == n - 1) {
          data.push(b[t][r][i][0]);
          data.push(b[t][r][i][1]);
          data.push(0);
        }
      }
    }
  }

  // последната точка на кривата съвпада с последната контролна точка
  if (n > 0) {
    data.push(controlPoints[n - 1].center[0]);
    data.push(controlPoints[n - 1].center[1]);
    data.push(0);
  }

  for (var i = 0; i < n; i++) {
    data.push(controlPoints[i].center[0]);
    data.push(controlPoints[i].center[1]);
    data.push(0);
  }

  this.n = controlPoints.length;
  this.color = [1, 0, 0];
  this.drawContour = drawContour;
  this.step = step;
  this.data = data;
  this.buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.data), gl.STATIC_DRAW);
}

// крива на Безие - рисуване
BezierCurve.prototype.draw = function () {
  pushMatrix();
  useMatrix();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
  gl.enableVertexAttribArray(aXYZ);
  gl.vertexAttribPointer(aXYZ, 3, gl.FLOAT, false, 3 * FLOATS, 0 * FLOATS);

  // рисуване на кривата
  gl.vertexAttrib3fv(aColor, this.color);
  gl.drawArrays(gl.LINE_STRIP, 0, this.step + 1);

  // рисуване на контура
  if (this.drawContour) {
    gl.vertexAttrib3fv(aColor, [0.6, 0.6, 1]);
    gl.drawArrays(gl.LINE_STRIP, this.step + 1, this.n);
  }
  popMatrix();
};

// Буква (поддържат се само X, Y и T)
Letter = function (center, letter) {
  var data = [];

  if (letter === "X") {
    data.push(-2);    data.push( 2);    data.push(0);
    data.push( 2);    data.push(-2);    data.push(0);
    data.push( 2);    data.push( 2);    data.push(0);
    data.push(-2);    data.push(-2);    data.push(0);
  } else if (letter === "Y") {
    data.push(-2);    data.push( 2);    data.push(0);
    data.push( 0);    data.push( 0);    data.push(0);
    data.push( 2);    data.push( 2);    data.push(0);
    data.push( 0);    data.push( 0);    data.push(0);
    data.push( 0);    data.push(-2);    data.push(0);
  } else if (letter === "T") {
    data.push(-2.5);  data.push(2);   data.push(0);
    data.push(2.5);   data.push(2);   data.push(0);
    data.push(0);     data.push(2);   data.push(0);
    data.push(0);     data.push(-2);  data.push(0);
  }

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

  this.color = [0.4, 0.51, 0.63];
  this.scale = [2, 3, 2];
  this.center = center;
  this.letter = letter;
  this.buf = buf;
};

// Буква - метод за рисуване
Letter.prototype.draw = function () {
  pushMatrix();
  gl.vertexAttrib3fv(aColor, this.color);
  translate(this.center);
  scale(this.scale);
  useMatrix();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
  gl.enableVertexAttribArray(aXYZ);
  gl.vertexAttribPointer(aXYZ, 3, gl.FLOAT, false, 3 * FLOATS, 0 * FLOATS);
  if (this.letter === "X") {
    gl.drawArrays(gl.LINES, 0, 2);
    gl.drawArrays(gl.LINES, 2, 2);
  } else if (this.letter === "Y") {
    gl.drawArrays(gl.LINE_STRIP, 0, 3);
    gl.drawArrays(gl.LINES, 3, 2);
  } else if (this.letter === "T") {
    gl.drawArrays(gl.LINES, 0, 2);
    gl.drawArrays(gl.LINES, 2, 2);
  }
  popMatrix();
};

//връща х координатата на мишката
function getX(event) {
  return event.clientX - gl.canvas.offsetLeft - gl.canvas.offsetWidth / 2;
}

//връща y координатата на мишката
function getY(event) {
  return -event.clientY + gl.canvas.offsetTop + gl.canvas.offsetHeight / 2;
}
