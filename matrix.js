const matrixIdentity = () => [1, 0, 0, 1, 0, 0];

const matrixClone = (m) => {
  return m.slice();
};

const matrixMultiply = (m1, m2) => {
  const [a, b, c, d, e, f] = m1;
  const [g, h, i, j, k, l] = m2;
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ];
};

const matrixByPoint = (m, p) => {
  const [a, b, c, d, e, f] = m;
  const { x, y } = p;
  return {
    x: a * x + c * y + e,
    y: b * x + d * y + f,
  };
};

const matrixScale = (sx, sy) => {
  return [sx, 0, 0, sy, 0, 0];
};

const matrixRotate = (angle) => {
  return [
    Math.cos(angle),
    Math.sin(angle),
    -Math.sin(angle),
    Math.cos(angle),
    0,
    0,
  ];
};

const matrixTranslate = (tx, ty) => {
  return [1, 0, 0, 1, tx, ty];
};

/*
Generates a 2D transformation matrix from a src bounding box to a dst position, defined
as a center, width, height and angle
*/
const matrixBox2Dst = (viewBox, dst) => {
  const [x0,y0,x1,y1] = viewBox;
  const {
    cx: dstCx,
    cy: dstCy,
    width: dstWidth,
    height: dstHeight,
    angle: dstAngle,
  } = dst;

  const srcWidth = x1 - x0;
  const srcHeight = y1 - y0;
  const srcCx = (x0+x1) * 0.5;
  const srcCy = (y0+y1) * 0.5;
  const sx = dstWidth / srcWidth;
  const sy = dstHeight / srcHeight; 

  /*
    Below equation:

    M = mTdst * mS * mTsrc

    Remember that operations on matrices are read right to left

    We first translate src position to the origin (-srcMin). 
    Then we scale to sx,sy (dstWidth/srcWidth,dstHeight/srcHeight)

    Finally we translate to the dst position (dstMin)
    */

  const m = matrixMultiply(
    matrixTranslate(dstCx, dstCy),
    matrixMultiply(
      matrixRotate(dstAngle),
      matrixMultiply(matrixScale(sx, sy), matrixTranslate(-srcCx, -srcCy))
    )
  );
  return m;
};

module.exports = {
  matrixMultiply,
  matrixByPoint,
  matrixScale,
  matrixRotate,
  matrixTranslate,
  matrixIdentity,
  matrixClone,
  matrixBox2Dst,
};
