"use client";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Draggable from 'react-draggable';

// -----------------------------------------------------------------------------
// 射影変換 (Perspective Correction) 用のユーティリティ
// -----------------------------------------------------------------------------
// 行列の乗算
const multiplyMatrix = (A, B) => {
    const C = new Array(9).fill(0);
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                C[i * 3 + j] += A[i * 3 + k] * B[k * 3 + j];
            }
        }
    }
    return C;
};

// 逆行列の計算 (3x3)
const invertMatrix = (M) => {
   const det = M[0] * (M[4] * M[8] - M[7] * M[5]) - 
               M[1] * (M[3] * M[8] - M[5] * M[6]) + 
               M[2] * (M[3] * M[7] - M[4] * M[6]);
   if (Math.abs(det) < 1e-6) return null;
   const invDet = 1.0 / det;
   return [
       (M[4] * M[8] - M[5] * M[7]) * invDet,
       (M[2] * M[7] - M[1] * M[8]) * invDet,
       (M[1] * M[5] - M[2] * M[4]) * invDet,
       (M[5] * M[6] - M[3] * M[8]) * invDet,
       (M[0] * M[8] - M[2] * M[6]) * invDet,
       (M[2] * M[3] - M[0] * M[5]) * invDet,
       (M[3] * M[7] - M[4] * M[6]) * invDet,
       (M[1] * M[6] - M[0] * M[7]) * invDet,
       (M[0] * M[4] - M[1] * M[3]) * invDet
   ];
};

// 4点からホモグラフィ行列を計算
// srcPoints: [{x,y}, {x,y}, {x,y}, {x,y}] (左上, 右上, 右下, 左下)
// dstPoints: [{x,y}, {x,y}, {x,y}, {x,y}]
// 参考: OpenCVのgetPerspectiveTransform的なロジック
// (ここでは簡易的に、JS向けのライブラリ実装を簡略化したものを使用)
const getPerspectiveTransform = (src, dst) => {
    // 8x8行列を解くための簡易Gaussian eliminationを使うか、
    // あるいは以下の定石的実装を使用
    // source: https://math.stackexchange.com/questions/296794/finding-the-transform-matrix-from-4-projected-points-with-javascript
    // (ここでは長くなるので、汎用的なライブラリロジックを最小実装)
    
    // 補助関数: Basis To Points
    const mapBasisToPoints = (p) => {
       const m = [
         p[0].x, p[1].x, p[2].x,
         p[0].y, p[1].y, p[2].y,
         1,      1,      1
       ];
       const adjM = [ // mの余因子行列の一部使って解く
          m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4],
          m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5],
          m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]
       ];
       const det = m[0]*adjM[0] + m[1]*adjM[3] + m[2]*adjM[6];
       if(Math.abs(det) < 1e-6) return null; // 共線など
       // これだと3点しか考慮してない。4点目は？
       // 一般的なホモグラフィ計算には8次元連立方程式を解く必要がある。
       
       // もっと単純な実装: "Projective Mappings for Image Warping", Paul Heckbert, 1989
       // Gaussian eliminationで行く。
       return null;
    };
    
    // ガウスの消去法でAx=bを解く実装に切り替え
    const solve = (A, b) => {
       const n = A.length;
       for (let i=0; i<n; i++) {
          let maxEl = Math.abs(A[i][i]);
          let maxRow = i;
          for(let k=i+1; k<n; k++) {
              if (Math.abs(A[k][i]) > maxEl) {
                  maxEl = Math.abs(A[k][i]);
                  maxRow = k;
              }
          }
          for (let k=i; k<n+1; k++) {
              let tmp = A[maxRow][k];
              A[maxRow][k] = A[i][k];
              A[i][k] = tmp;
          }
          // bも入れ替え (Aの拡張部分として扱うためAは n x (n+1) とする)
       }
       // ...手書きはバグりやすいので、平面投影に特化した計算式を使う
       // 目的: src(u,v) -> dst(x,y) の変換行列Hを求める
    };

    // 4点から正方形(0,0,1,0,1,1,0,1)への変換行列を求める関数
    const squareToQuad = (p) => {
       const x0=p[0].x, y0=p[0].y;
       const x1=p[1].x, y1=p[1].y;
       const x2=p[2].x, y2=p[2].y;
       const x3=p[3].x, y3=p[3].y;
       
       const dx1 = x1 - x2, dy1 = y1 - y2;
       const dx2 = x3 - x2, dy2 = y3 - y2;
       const sx = x0 - x1 + x2 - x3;
       const sy = y0 - y1 + y2 - y3;
       
       const g = (sx * dy2 - dx2 * sy) / (dx1 * dy2 - dx2 * dy1);
       const h = (dx1 * sy - sx * dy1) / (dx1 * dy2 - dx2 * dy1);
       
       const a = x1 - x0 + g * x1;
       const b = x3 - x0 + h * x3;
       const c = x0;
       const d = y1 - y0 + g * y1;
       const e = y3 - y0 + h * y3;
       const f = y0;
       
       return [a, b, c, d, e, f, g, h, 1];
    };
    
    // (src -> square) * (square -> dst)^-1 と考えるが
    // ここでは単純に srcの四角形 -> dstの四角形 への変換行列 H を求める
    // H = (squareToQuad(dst)) * (squareToQuad(src))^-1
    
    const sToQ_src = squareToQuad(src);
    const sToQ_dst = squareToQuad(dst); // dstは今回のケースでは長方形(0,0)-(w,h)
    
    // 逆行列
    const inv_src = invertMatrix(sToQ_src);
    if (!inv_src) return null;
    
    // 結合: dst * src^-1
    return multiplyMatrix(sToQ_dst, inv_src); 
};


// 個別のパーツをレンダリングするコンポーネント
const DraggablePart = ({ part, scale, zoom, onSelect, isSelected, updatePart, containerRef, onExport, onRemoveBg, onRestore, onPerspective }) => {
  const nodeRef = useRef(null);
  
  if (part.visible === false) return null; // 非表示の場合はレンダリングしない

  // スケール計算
  const isHeightMetric = part.metricType === 'height';
  const displaySize = part.mm * scale;

  // 回転ハンドルのドラッグ処理
  const handleRotateStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // パーツの中心座標を取得
    const rect = nodeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const handleMouseMove = (moveEvent) => {
      // 中心からマウスへの角度を計算 (ラジアン)
      const angleRad = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
      let angleDeg = angleRad * (180 / Math.PI);
      
      // マウスが上(-90度)にあるときを0度としたいので +90度
      angleDeg += 90;

      updatePart(part.id, { rotation: Math.round(angleDeg) });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <Draggable 
      nodeRef={nodeRef}
      scale={zoom}
      onStart={(e) => {
        e.stopPropagation(); // 親へのイベント伝播を止める
        onSelect(part.id);
      }}
      defaultPosition={part.position}
      onDrag={(e) => {
        e.stopPropagation(); // ドラッグ中も止める
      }}
      onStop={(e, data) => {
        e.stopPropagation(); // 終了時も止める
        updatePart(part.id, { position: { x: data.x, y: data.y } });
      }}
    >
      <div 
        ref={nodeRef} 
        className={`absolute top-0 left-0 cursor-move group ${isSelected ? 'z-[9999]' : ''}`}
        // 選択時は最前面に表示
        style={{ 
          width: isHeightMetric ? 'auto' : `${displaySize}px`,
          height: isHeightMetric ? `${displaySize}px` : 'auto',
          minWidth: isHeightMetric ? undefined : '1px',
          minHeight: isHeightMetric ? '1px' : undefined
        }} 
        onClick={(e) => {
           e.stopPropagation();
           onSelect(part.id);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onPointerDown={(e) => { // ポインターイベントもしっかり止める
          e.stopPropagation();
        }}
      >
        <img 
          src={part.src} 
          className={`transition-shadow select-none ${isSelected ? 'ring-2 ring-blue-500 shadow-xl' : 'hover:ring-1 ring-blue-300'} ${isHeightMetric ? 'h-full w-auto' : 'w-full h-auto'}`}
          style={{ 
            transform: `rotate(${part.rotation}deg) scaleX(${part.flip ? -1 : 1})`
          }}
          alt="Part"
          draggable={false}
        />

        {/* 修正: ハンドルを回転に追従させるため、回転するラッパーを用意するか、imgと同じ階層で回転させる */}
        {isSelected && (
           <div 
             className="absolute top-0 left-0 w-full h-full pointer-events-none"
             style={{ transform: `rotate(${part.rotation}deg)` }}
           >
              {/* ハンドルと本体をつなぐ線 (回転ハンドル下部から画像まで) */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-blue-500 pointer-events-none"></div>

              {/* 回転ハンドル */}
              <div 
                 className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md pointer-events-auto"
                 onMouseDown={handleRotateStart}
                 onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </div>
           </div>
        )}


        {/* 選択時に表示されるフローティング操作パネル */}
        {isSelected && (
          <div 
            className="absolute top-full left-1/2 mt-8 bg-white p-3 rounded-lg shadow-xl border border-blue-500 flex flex-col gap-2"
            style={{  
              width: 'max-content',
              minWidth: '280px',
              maxWidth: '90vw',
              transform: `translateX(-50%) scale(${1/zoom})`, // 中央寄せ + ズーム相殺
              transformOrigin: 'top center',
              zIndex: 1000,
              cursor: 'default'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
             {/* パネルと画像をつなぐ線 (突き刺さらないよう長さを調整) */}
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-blue-500 pointer-events-none"></div>

             <div className="flex items-center gap-2">
               {/* 全長入力 */}
               <div className="flex items-center gap-1">
                  <select
                     value={part.metricType || 'width'}
                     onChange={(e) => updatePart(part.id, { metricType: e.target.value })}
                     onClick={(e) => e.stopPropagation()}
                     onMouseDown={(e) => e.stopPropagation()}
                     className="text-xs font-bold text-black border border-gray-300 bg-white/90 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                  >
                     <option value="width">幅</option>
                     <option value="height">高</option>
                  </select>
                  <input 
                    type="number" 
                    value={part.mm} 
                    onChange={(e) => updatePart(part.id, { mm: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="border border-gray-300 bg-white/90 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 font-bold text-black text-right w-[4.5em]" // 半角4桁分程度の幅
                  />
                  <span className="text-xs text-black font-bold" style={{ textShadow: '0 0 3px rgba(255,255,255,0.8)' }}>mm</span>
               </div>

               {/* 回転入力 */}
               <div className="flex items-center gap-1 ml-2">
                 <span className="text-xs font-bold text-black whitespace-nowrap" style={{ textShadow: '0 0 3px rgba(255,255,255,0.8)' }}>角度</span>
                 <input 
                    type="number" 
                    value={part.rotation.toString()} // 0でも空文字でもなく文字列化して渡すことで挙動安定化
                    onChange={(e) => {
                       const val = e.target.value;
                       updatePart(part.id, { rotation: val === '' ? 0 : Number(val) });
                    }}
                    className="border border-gray-300 bg-white/90 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 font-bold text-black text-right w-[3.5em]" // 半角3桁分程度の幅
                 />
                 <span className="text-xs text-black font-bold" style={{ textShadow: '0 0 3px rgba(255,255,255,0.8)' }}>°</span>
               </div>
            </div>
          
            <div className="flex justify-between items-center border-t border-white/20 pt-2 mt-1">
               <label className="flex items-center gap-1 cursor-pointer hover:bg-white/20 px-1 rounded transition-colors">
                  <input 
                    type="checkbox" 
                    checked={part.flip} 
                    onChange={(e) => updatePart(part.id, { flip: e.target.checked })}
                    className="rounded text-green-600 focus:ring-green-500 h-3 w-3 bg-white border-gray-400 shadow-sm"
                  />
                  <span className="text-xs text-black font-bold" style={{ textShadow: '0 0 3px rgba(255,255,255,0.8)' }}>左右反転</span>
               </label>
               
               <div className="flex gap-1 ml-auto">
                 {/* 背景透過ボタン */}
                 <button
                    onClick={(e) => {
                       e.stopPropagation();
                       if (part.originalSrc) {
                          onRestore();
                       } else {
                          onRemoveBg();
                       }
                    }}
                    className={`text-xs px-2 py-0.5 rounded shadow flex items-center gap-1 ${part.originalSrc ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-purple-600 hover:bg-purple-700'} text-white`}
                    title={part.originalSrc ? "元画像に戻す" : "背景色を透過 (左上が基準)"}
                 >
                    {part.originalSrc ? (
                       <>
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                         復元
                       </>
                    ) : (
                       <>
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                         透過
                       </>
                    )}
                 </button>

                 <button
                    onClick={(e) => {
                       e.stopPropagation();
                       onPerspective();
                    }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded shadow flex items-center gap-1"
                    title="形状補正 (パース補正)"
                 >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    補正
                 </button>

                 <button
                    onClick={(e) => {
                       e.stopPropagation();
                       onExport();
                    }}
                    className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-2 py-0.5 rounded shadow flex items-center gap-1"
                    title="このパーツを保存"
                 >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    保存
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </Draggable>
  );
};

// -----------------------------------------------------------------------------
// パース補正用のハンドルコンポーネント (nodeRef対応)
// -----------------------------------------------------------------------------
const PerspectiveHandle = ({ pos, onDrag }) => {
  const nodeRef = useRef(null);
  return (
      <Draggable
         nodeRef={nodeRef}
         position={pos}
         onDrag={onDrag}
         bounds="parent"
      >
         <div ref={nodeRef} className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-move shadow border-2 border-white hover:scale-125 transition-transform z-10"></div>
      </Draggable>
  );
};

// -----------------------------------------------------------------------------
// パース補正ロジック (CSS Transform相当の計算)
// -----------------------------------------------------------------------------
const calculateTransformedCorners = (w, h, rotate, tiltX, tiltY) => {
    // CSSのtransform: perspective(1000px) rotateX(...) rotateY(...) rotateZ(...) をシミュレート
    // 座標系: 中心原点、Y下向き、X右向き、Z手前向き（右手系とするがCSSはZ奥が負の手前正？）
    // Note: CSSのrotateXはX軸回転。rotateYはY軸回転。
    const f = 1000; // perspective distance
    
    const rad = (deg) => deg * Math.PI / 180;
    const rX = rad(tiltY); // Vertical Tilt -> Rotate X
    const rY = rad(-tiltX); // Horizontal Tilt -> Rotate Y (正負逆の方が感覚に近い場合あり調整)
    const rZ = rad(rotate);
    
    // 回転行列の計算などを真面目にやる、あるいは点ごとに回す
    const corners = [
        {x: -w/2, y: -h/2, z: 0}, // TL
        {x:  w/2, y: -h/2, z: 0}, // TR
        {x:  w/2, y:  h/2, z: 0}, // BR
        {x: -w/2, y:  h/2, z: 0}  // BL
    ];
    
    const transformed = corners.map(p => {
        // 1. Rotate X
        let y1 = p.y * Math.cos(rX) - p.z * Math.sin(rX);
        let z1 = p.y * Math.sin(rX) + p.z * Math.cos(rX);
        let x1 = p.x;
        
        // 2. Rotate Y
        let x2 = x1 * Math.cos(rY) + z1 * Math.sin(rY);
        let z2 = -x1 * Math.sin(rY) + z1 * Math.cos(rY);
        let y2 = y1;
        
        // 3. Rotate Z
        let x3 = x2 * Math.cos(rZ) - y2 * Math.sin(rZ);
        let y3 = x2 * Math.sin(rZ) + y2 * Math.cos(rZ);
        let z3 = z2;
        
        // 4. Perspective Projection
        // 視点は (0, 0, f)。投影面は z=0。
        // 比率 scale = f / (f - z)  (カメラが手前:+z にある場合、物体が奥:-z に行くと f/(f-(-z)) < 1 で縮小)
        // CSSのperspectiveは「スクリーン(z=0)から視点への距離」
        // 物体を回転させて z が手前(プラス)に来ると拡大、奥(マイナス)に行くと縮小
        // ここでのz3はどっちだ？ 
        // 右手系で回した。CSS仕様に合わせるなら調整が必要だが、概ねこれでよい。
        // しかしCSSの視点は手前にあるので、zが手前に来ると分母が小さくなり拡大。
        // f - z3 で計算する。
        
        const scale = f / (f - z3);
        
        return {
            x: x3 * scale + w/2,
            y: y3 * scale + h/2
        };
    });
    
    return transformed;
};

// -----------------------------------------------------------------------------
// パース補正用のオーバーレイコンポーネント (2段階：変形 -> 切り抜き)
// -----------------------------------------------------------------------------
const PerspectiveOverlay = ({ perspectiveMode, setPerspectiveMode, onApply, extractMode, setExtractMode, onCreatePart }) => {
  const [step, setStep] = useState('transform'); // 'transform' | 'crop'
  const [params, setParams] = useState({ rotate: 0, tiltX: 0, tiltY: 0 }); 
  const containerRef = useRef(null);
  
  // Crop用
  const [cropSrc, setCropSrc] = useState(null);

  useEffect(() => {
     if (extractMode) {
         setStep('crop');
         setCropSrc(extractMode.src);
         setPolyPoints([]);
         setCropType('rect');
     } else if (perspectiveMode) {
         setStep('transform');
         setCropSrc(null);
         setParams({ rotate: 0, tiltX: 0, tiltY: 0 });
         setPolyPoints([]);
         setCropType('rect');
     }
  }, [extractMode, perspectiveMode]);
  const [cropRect, setCropRect] = useState(null); // { x, y, w, h } (画像座標系)
  const cropImgRef = useRef(null);
  const [cropLayout, setCropLayout] = useState(null); // { scale, offsetX, offsetY }
  // Cropハンドル: 0=TL, 1=BR (簡略化のため対角2点方式)
  const [cropHandles, setCropHandles] = useState(null); 
  const [deleteOriginal, setDeleteOriginal] = useState(false); // 元の領域を削除するかどうか 
  const [cropType, setCropType] = useState('rect'); // 'rect' | 'poly'
  const [polyPoints, setPolyPoints] = useState([]); // [{x,y}, ...] 画像座標系 

  // 変形画像を生成する関数 (Step 1 -> Step 2)
  const generateTransformedImage = useCallback(() => {
      const { src, w, h } = perspectiveMode;
      const transformedCorners = calculateTransformedCorners(w, h, params.rotate, params.tiltX, params.tiltY);
      
      const minX = Math.min(...transformedCorners.map(p => p.x));
      const maxX = Math.max(...transformedCorners.map(p => p.x));
      const minY = Math.min(...transformedCorners.map(p => p.y));
      const maxY = Math.max(...transformedCorners.map(p => p.y));
      
      const outW = Math.round(maxX - minX);
      const outH = Math.round(maxY - minY);
      
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = src;
      return new Promise((resolve) => {
          img.onload = () => {
             const canvas = document.createElement('canvas');
             canvas.width = outW;
             canvas.height = outH;
             const ctx = canvas.getContext('2d');
             
             // 補間品質を確保
             ctx.imageSmoothingEnabled = true;
             ctx.imageSmoothingQuality = 'high';

             const outData = ctx.createImageData(outW, outH);
             
             const srcCanvas = document.createElement('canvas');
             srcCanvas.width = w;
             srcCanvas.height = h;
             const srcCtx = srcCanvas.getContext('2d');
             srcCtx.drawImage(img, 0, 0);
             const srcData = srcCtx.getImageData(0, 0, w, h);
             
             const dstPoints = transformedCorners.map(p => ({
                 x: p.x - minX,
                 y: p.y - minY
             }));
             const srcPoints = [
                 {x: 0, y: 0}, {x: w, y: 0},
                 {x: w, y: h}, {x: 0, y: h}
             ];
             
             const H = getPerspectiveTransform(dstPoints, srcPoints);
             if (!H) { resolve(null); return; }
             
             for(let y=0; y<outH; y++) {
               for(let x=0; x<outW; x++) {
                  const D = H[6]*x + H[7]*y + 1;
                  if (Math.abs(D) < 1e-9) continue;
                  const u = (H[0]*x + H[1]*y + H[2]) / D;
                  const v = (H[3]*x + H[4]*y + H[5]) / D;
                  const srcX = Math.round(u);
                  const srcY = Math.round(v);
                  if (srcX >=0 && srcX < w && srcY >=0 && srcY < h) {
                      const outIdx = (y * outW + x) * 4;
                      const srcIdx = (srcY * w + srcX) * 4;
                      outData.data[outIdx] = srcData.data[srcIdx];
                      outData.data[outIdx+1] = srcData.data[srcIdx+1];
                      outData.data[outIdx+2] = srcData.data[srcIdx+2];
                      outData.data[outIdx+3] = srcData.data[srcIdx+3];
                  }
               }
            }
            ctx.putImageData(outData, 0, 0);
            resolve(canvas.toDataURL());
          };
      });
  }, [perspectiveMode, params]);

  const goToCropStep = async () => {
      const url = await generateTransformedImage();
      if (url) {
          setCropSrc(url);
          setStep('crop');
      }
  };
  
  // Cropレイアウト計算
  const updateCropLayout = () => {
      if (cropImgRef.current && containerRef.current) {
          const cw = containerRef.current.clientWidth;
          const ch = containerRef.current.clientHeight;
          const iw = cropImgRef.current.naturalWidth;
          const ih = cropImgRef.current.naturalHeight;
          if (!iw || !ih) return;
          
          const scale = Math.min(cw / iw, ch / ih) * 0.9; // 余白を少し持たせる
          const dw = iw * scale;
          const dh = ih * scale;
          const ox = (cw - dw) / 2;
          const oy = (ch - dh) / 2;
          setCropLayout({ scale, offsetX: ox, offsetY: oy, w: iw, h: ih });
          
          // 初期Crop範囲は画像全体より少し内側
          if (!cropHandles) {
              setCropHandles([
                  { x: iw * 0.05, y: ih * 0.05 }, // TL
                  { x: iw * 0.95, y: ih * 0.95 }  // BR
              ]);
          }
      }
  };
  
  useEffect(() => {
      if (step === 'crop') {
         window.addEventListener('resize', updateCropLayout);
         // 少し待ってから実行（レンダリング安定待ち）
         const timer = setTimeout(updateCropLayout, 100);
         return () => {
             window.removeEventListener('resize', updateCropLayout);
             clearTimeout(timer);
         };
      }
  }, [step, cropSrc]);

  const executeCrop = () => {
      if (!cropSrc || !cropLayout) return;
      if (cropType === 'rect' && (!cropHandles)) return;
      if (cropType === 'poly' && polyPoints.length < 3) return;

      const img = new Image();
      img.src = cropSrc;
      img.onload = () => {
          let canvas, x, y, w, h;

          if (cropType === 'rect') {
              const x1 = Math.min(cropHandles[0].x, cropHandles[1].x);
              const y1 = Math.min(cropHandles[0].y, cropHandles[1].y);
              const x2 = Math.max(cropHandles[0].x, cropHandles[1].x);
              const y2 = Math.max(cropHandles[0].y, cropHandles[1].y);
              
              w = Math.max(1, x2 - x1);
              h = Math.max(1, y2 - y1);
              x = x1;
              y = y1;
              
              canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
          } else {
              // Polygon
              const minX = Math.min(...polyPoints.map(p => p.x));
              const maxX = Math.max(...polyPoints.map(p => p.x));
              const minY = Math.min(...polyPoints.map(p => p.y));
              const maxY = Math.max(...polyPoints.map(p => p.y));
              
              x = minX;
              y = minY;
              w = Math.max(1, maxX - minX);
              h = Math.max(1, maxY - minY);
              
              canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              
              ctx.beginPath();
              ctx.moveTo(polyPoints[0].x - x, polyPoints[0].y - y);
              for (let i = 1; i < polyPoints.length; i++) {
                 ctx.lineTo(polyPoints[i].x - x, polyPoints[i].y - y);
              }
              ctx.closePath();
              ctx.clip();
              
              ctx.drawImage(img, -x, -y);
          }
          
          const result = { 
              resultSrc: canvas.toDataURL(),
              deleteOriginal,
              cropType,
              cropRect: { x, y, w, h }, // 削除用にバウンディングボックスも渡す
              polyPoints: cropType === 'poly' ? polyPoints : null
          };
          
          if (perspectiveMode) {
             onApply(result);
          } else if (extractMode) {
             onCreatePart(result);
          }
      };
  };

  // スクリーン座標 -> 画像座標 (Crop)
  const screenToCropImg = (sx, sy) => {
      if (!cropLayout) return {x:0, y:0};
      // sx, sy はドキュメント全体基準ではなく Draggable親基準 => コンテナ基準
      // Draggableは absolute で配置されている
      const x = (sx - cropLayout.offsetX) / cropLayout.scale; 
      const y = (sy - cropLayout.offsetY) / cropLayout.scale;
      return { x, y };
  };
  
  const cropImgToScreen = (ix, iy) => {
      if (!cropLayout) return {x:0, y:0};
      return {
          x: ix * cropLayout.scale + cropLayout.offsetX,
          y: iy * cropLayout.scale + cropLayout.offsetY
      };
  };

  const handleContainerClick = (e) => {
      if (step !== 'crop' || cropType !== 'poly' || !cropLayout) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      
      const pt = screenToCropImg(clientX, clientY);
      // 範囲外クリックのガード
      pt.x = Math.max(0, Math.min(cropLayout.w, pt.x));
      pt.y = Math.max(0, Math.min(cropLayout.h, pt.y));

      setPolyPoints(prev => [...prev, pt]);
  };

  const activeMode = perspectiveMode || extractMode;
  if (!activeMode) return null;
  
  const handleClose = () => {
      if (setPerspectiveMode) setPerspectiveMode(null);
      if (setExtractMode) setExtractMode(null);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black flex flex-col select-none"
         onClick={(e) => e.stopPropagation()}
    >
       {/* Header */}
       <div className="flex justify-between items-center p-4 bg-[#111] text-white shrink-0 z-20">
          <div className="flex flex-col">
             <h3 className="font-bold text-lg">
                 {step === 'transform' ? '形状補正 (1/2)' : (extractMode ? 'パーツ切り出し' : '切り抜き (2/2)')}
             </h3>
             <p className="text-xs text-gray-400">
                 {step === 'transform' ? 'スライダーで画像を正面に向けてください' : '必要な範囲を選択してください'}
             </p>
          </div>
          <div className="flex gap-3">
             {step === 'crop' && !extractMode && (
                 <button onClick={() => setStep('transform')} className="px-3 py-1 text-gray-400 hover:text-white border border-gray-600 rounded">
                     戻る
                 </button>
             )}
             <button onClick={handleClose} className="px-3 py-1 text-gray-400 hover:text-white">
                 閉じる
             </button>
          </div>
       </div>
       
       {/* Main Area */}
       <div className="relative flex-1 bg-[#050505] overflow-hidden flex items-center justify-center" ref={containerRef}>
          
          {/* STEP 1: 変形モード */}
          {step === 'transform' && perspectiveMode && (
              <div className="relative transition-transform duration-100 ease-linear"
                  style={{
                      width: perspectiveMode.w,
                      height: perspectiveMode.h,
                      transform: `scale(${ Math.min(
                          (containerRef.current?.clientWidth || 1000) * 0.9 / perspectiveMode.w, 
                          (containerRef.current?.clientHeight || 800) * 0.9 / perspectiveMode.h 
                      ) || 0.5 })` 
                  }}>
                 {/* グリッド (固定) */}
                 <div className="absolute -inset-[50%] pointer-events-none z-10 flex items-center justify-center opacity-20">
                      <div className="w-full h-px bg-white"></div>
                      <div className="h-full w-px bg-white absolute"></div>
                 </div>
                 
                 <img 
                   src={perspectiveMode.src} 
                   alt="Preview"
                   className="w-full h-full object-contain"
                   style={{
                       transform: `perspective(1000px) rotateX(${params.tiltY}deg) rotateY(${-params.tiltX}deg) rotateZ(${params.rotate}deg)`,
                       transformOrigin: 'center center',
                       boxShadow: '0 0 50px rgba(0,0,0,0.8)'
                   }}
                 />
              </div>
          )}

          {/* STEP 2: 切り抜きモード */}
          {step === 'crop' && cropSrc && (
              <>
                 <img 
                     ref={cropImgRef}
                     src={cropSrc} 
                     alt="Crop Target"
                     className="absolute pointer-events-none opacity-50"
                     style={{
                         width: cropLayout ? cropLayout.w * cropLayout.scale : 'auto',
                         height: cropLayout ? cropLayout.h * cropLayout.scale : 'auto',
                         top: cropLayout ? cropLayout.offsetY : 0,
                         left: cropLayout ? cropLayout.offsetX : 0,
                     }}
                     onLoad={updateCropLayout}
                 />
                 
                 {/* Polygon Click Area (Top Layer) */}
                 {cropLayout && cropType === 'poly' && (
                    <div 
                      className="absolute inset-0 z-30 cursor-crosshair"
                      onClick={handleContainerClick}
                      onContextMenu={(e) => {
                          e.preventDefault();
                          // Right click to remove last point
                          setPolyPoints(prev => prev.slice(0, -1));
                      }}
                    >
                         <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                             {polyPoints.length > 0 && (
                                <polygon 
                                   points={polyPoints.map(p => {
                                       const sc = cropImgToScreen(p.x, p.y);
                                       return `${sc.x},${sc.y}`;
                                   }).join(' ')}
                                   fill="rgba(0, 255, 0, 0.3)"
                                   stroke="#00ff00"
                                   strokeWidth="2"
                                />
                             )}
                             {polyPoints.map((p, i) => {
                                 const sc = cropImgToScreen(p.x, p.y);
                                 return (
                                    <circle key={i} cx={sc.x} cy={sc.y} r="4" fill="#00ff00" stroke="white" strokeWidth="1"/>
                                 );
                             })}
                             {/* Preview line from last point to cursor? Not easy without tracking mouse move state. Skip for now. */}
                         </svg>
                         
                         {/* Poly Mode Instructions Overlay */}
                         {polyPoints.length === 0 && (
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-sm pointer-events-none">
                                クリックして点を追加
                             </div>
                         )}
                    </div>
                 )}

                 {cropLayout && cropType === 'rect' && cropHandles && (
                    <div className="absolute inset-0 z-20">
                        {/* 切り抜き枠の描画 */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
                            <defs>
                                <mask id="crop-mask">
                                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                    <rect 
                                        x={Math.min(cropHandles[0].x, cropHandles[1].x) * cropLayout.scale + cropLayout.offsetX}
                                        y={Math.min(cropHandles[0].y, cropHandles[1].y) * cropLayout.scale + cropLayout.offsetY}
                                        width={Math.abs(cropHandles[1].x - cropHandles[0].x) * cropLayout.scale}
                                        height={Math.abs(cropHandles[1].y - cropHandles[0].y) * cropLayout.scale}
                                        fill="black"
                                    />
                                </mask>
                            </defs>
                            {/* 暗幕 */}
                            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#crop-mask)" />
                            
                            {/* 枠線 */}
                            <rect 
                                x={Math.min(cropHandles[0].x, cropHandles[1].x) * cropLayout.scale + cropLayout.offsetX}
                                y={Math.min(cropHandles[0].y, cropHandles[1].y) * cropLayout.scale + cropLayout.offsetY}
                                width={Math.abs(cropHandles[1].x - cropHandles[0].x) * cropLayout.scale}
                                height={Math.abs(cropHandles[1].y - cropHandles[0].y) * cropLayout.scale}
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeDasharray="4"
                            />
                        </svg>
                        
                        {/* 鮮明な画像（切り抜きエリア内だけ表示） */}
                       <div className="absolute overflow-hidden"
                            style={{
                                left: Math.min(cropHandles[0].x, cropHandles[1].x) * cropLayout.scale + cropLayout.offsetX,
                                top: Math.min(cropHandles[0].y, cropHandles[1].y) * cropLayout.scale + cropLayout.offsetY,
                                width: Math.abs(cropHandles[1].x - cropHandles[0].x) * cropLayout.scale,
                                height: Math.abs(cropHandles[1].y - cropHandles[0].y) * cropLayout.scale,
                                zIndex: 5
                            }}>
                           <img 
                             src={cropSrc} 
                             className="absolute max-w-none"
                             style={{
                                width: cropLayout.w * cropLayout.scale,
                                height: cropLayout.h * cropLayout.scale,
                                left: -Math.min(cropHandles[0].x, cropHandles[1].x) * cropLayout.scale,
                                top: -Math.min(cropHandles[0].y, cropHandles[1].y) * cropLayout.scale,
                             }}
                           />
                       </div>

                        {/* ハンドル */}
                        {cropHandles.map((h, i) => {
                           const pos = cropImgToScreen(h.x, h.y);
                           return (
                              <PerspectiveHandle
                                 key={i}
                                 pos={pos}
                                 onDrag={(e, data) => {
                                    const imgPos = screenToCropImg(data.x, data.y);
                                    // 範囲制限
                                    imgPos.x = Math.max(0, Math.min(cropLayout.w, imgPos.x));
                                    imgPos.y = Math.max(0, Math.min(cropLayout.h, imgPos.y));
                                    
                                    setCropHandles(prev => {
                                       const next = [...prev];
                                       next[i] = imgPos;
                                       return next;
                                    });
                                 }}
                              />
                           );
                        })}
                    </div>
                 )}
              </>
          )}

       </div>

       {/* Footer / Controls */}
       <div className="bg-[#111] p-4 text-white shrink-0 z-20">
         {step === 'transform' ? (
             <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-1">
                       <label className="text-xs text-gray-400">回転 (Roll): {params.rotate}°</label>
                       <input type="range" min="-45" max="45" step="0.5" value={params.rotate}
                              onChange={e => setParams({...params, rotate: parseFloat(e.target.value)})}
                              className="w-full h-1 bg-gray-600 rounded-lg cursor-pointer accent-blue-500"/>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs text-gray-400">水平 (Yaw): {params.tiltX}°</label>
                       <input type="range" min="-60" max="60" step="1" value={params.tiltX}
                              onChange={e => setParams({...params, tiltX: parseFloat(e.target.value)})}
                              className="w-full h-1 bg-gray-600 rounded-lg cursor-pointer accent-blue-500"/>
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs text-gray-400">垂直 (Pitch): {params.tiltY}°</label>
                       <input type="range" min="-60" max="60" step="1" value={params.tiltY}
                              onChange={e => setParams({...params, tiltY: parseFloat(e.target.value)})}
                              className="w-full h-1 bg-gray-600 rounded-lg cursor-pointer accent-blue-500"/>
                    </div>
                 </div>
                 <div className="flex justify-center mt-2">
                     <button onClick={goToCropStep} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-lg shadow-lg flex items-center gap-2">
                         次へ（切り抜き）
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                     </button>
                 </div>
             </div>
         ) : (
             <div className="flex flex-col items-center gap-3 pb-2">
                 {/* Mode Switcher */}
                 <div className="flex bg-gray-800 rounded-lg p-1 gap-1 mb-1">
                     <button
                        onClick={() => setCropType('rect')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${cropType === 'rect' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                     >
                        矩形
                     </button>
                     <button
                        onClick={() => setCropType('poly')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${cropType === 'poly' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                     >
                        多角形
                     </button>
                 </div>

                 {extractMode && (
                     <label className="flex items-center gap-2 cursor-pointer bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                         <input 
                             type="checkbox" 
                             checked={deleteOriginal} 
                             onChange={e => setDeleteOriginal(e.target.checked)}
                             className="w-5 h-5 accent-red-500 rounded"
                         />
                         <span className="text-sm font-medium text-gray-200">元の画像から切り取った部分を削除する</span>
                     </label>
                 )}
                 <button onClick={executeCrop} className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-full font-bold text-lg shadow-lg flex items-center gap-2">
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     完了・保存
                 </button>
             </div>
         )}
       </div>
    </div>
  );
};

export default function AirsoftSimulator() {
  const [baseImg, setBaseImg] = useState({ src: null, mm: 800, widthPx: 0, transparentMode: true, flip: false, originalSrc: null });
  const [parts, setParts] = useState([]);
  const [selectedPartId, setSelectedPartId] = useState(null);
  const [isBaseSelected, setIsBaseSelected] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [dragOverInfo, setDragOverInfo] = useState({ id: null, position: null }); // ドラッグ&ドロップのインジケーター用
  const [perspectiveMode, setPerspectiveMode] = useState(null); // { partId, src, handles: [{x,y}...4] }
  const [extractMode, setExtractMode] = useState(null); // { src }
  const containerRef = useRef(null);
  const baseImgRef = useRef(null);
  const baseDraggableRef = useRef(null);
  const fileInputRef = useRef(null); // プロジェクト読み込み用
  
  // 補正モード開始
  const startPerspective = (part) => {
     // 画像サイズを取得するために一旦Imageロード
     const img = new Image();
     img.src = part.src;
     img.onload = () => {
        // 初期ハンドルは画像の四隅 (少し内側にする)
        const w = img.width;
        const h = img.height;
        setPerspectiveMode({
           partId: part.id,
           src: part.src,
           w, h,
           handles: [
              {x: 0, y: 0},     // TL
              {x: w, y: 0},     // TR
              {x: w, y: h},     // BR
              {x: 0, y: h}      // BL
           ]
        });
     };
  };

  // 補正実行
  const applyPerspective = (result) => {
     if (result && result.resultSrc) {
        const { partId } = perspectiveMode;
        updatePart(partId, { src: result.resultSrc });
        setPerspectiveMode(null);
     }
  };

  // 切り出し実行
  const handleCreatePart = (result) => {
      if (result && result.resultSrc) {
          const newPart = {
              id: crypto.randomUUID(),
              name: '切り出しパーツ',
              src: result.resultSrc,
              mm: 100, // デフォルトサイズ
              metricType: 'width',
              rotation: 0,
              flip: false,
              transparentMode: true,
              visible: true,
              position: { x: 50, y: 50 }
          };

          // 元画像の削除処理がある場合
          if (extractMode && extractMode.targetType === 'base' && result.deleteOriginal && result.cropRect) {
              const rect = result.cropRect;
              // 元画像を加工して更新
              const img = new Image();
              img.src = baseImg.src;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0);
                  // 切り抜き部分を透明にする
                  ctx.globalCompositeOperation = 'destination-out';
                  ctx.fillStyle = 'black';
                  
                  if (result.cropType === 'poly' && result.polyPoints) {
                      ctx.beginPath();
                      result.polyPoints.forEach((p, i) => {
                          if (i === 0) ctx.moveTo(p.x, p.y);
                          else ctx.lineTo(p.x, p.y);
                      });
                      ctx.closePath();
                      ctx.fill();
                  } else {
                      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                  }
                  
                  // 更新を反映
                  setBaseImg(prev => ({ ...prev, src: canvas.toDataURL() }));
              };
          }

          setParts(prev => [...prev, newPart]);
          setSelectedPartId(newPart.id);
          setExtractMode(null);
      }
  };


  // プロジェクト保存機能
  const saveProject = () => {
    if (!baseImg.src) {
       alert("ベース画像がありません。");
       return;
    }

    const projectData = {
       baseImg: {
          ...baseImg,
          src: baseImg.src // Blob URLなので永続化できないが、一連の操作内では有効。リロード対策するならDataURL変換が必要
       },
       parts: parts.map(p => ({
          ...p,
          src: p.src // こちらもBlob URL
       })),
       zoom
    };

    // Blob URLをDataURLに変換して保存するための非同期処理
    // ※ 簡易実装として、現在のURLをそのままJSONにするだけではリロードで消えるため、
    //    本来はCanvas等で画像データをbase64化するか、File APIで再読み込みさせる必要がある。
    //    ここでは「DataURLへの変換」を行ってから保存するロジックを追加する。
    
    const convertToDataURL = async (blobUrl) => {
       const response = await fetch(blobUrl);
       const blob = await response.blob();
       return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
       });
    };

    const saveAsync = async () => {
       try {
          // ベース画像の変換
          const baseDataUrl = await convertToDataURL(baseImg.src);
          // パーツ画像の変換
          const partsWithDataUrl = await Promise.all(parts.map(async (p) => ({
             ...p,
             src: await convertToDataURL(p.src)
          })));

          const fullData = {
             version: 1,
             timestamp: new Date().toISOString(),
             baseImg: { ...baseImg, src: baseDataUrl },
             parts: partsWithDataUrl,
             zoom
             // 状態管理の一部（選択状態など）は保存しない
          };
          
          const blob = new Blob([JSON.stringify(fullData)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `airsoft-sim-project-${new Date().getTime()}.json`;
          a.click();
          URL.revokeObjectURL(url);
       } catch (error) {
          console.error("Save failed:", error);
          alert("保存に失敗しました。");
       }
    };
    
    saveAsync();
  };

  // 選択中のパーツをエクスポートする機能
  const exportSelectedPart = () => {
     if (!selectedPartId) return;
     const part = parts.find(p => p.id === selectedPartId);
     if (!part) return;

     // DataURL変換ヘルパー
     const convertToDataURL = async (blobUrl) => {
        // blob:以外(data:など)ならそのまま返す
        if (blobUrl.startsWith('data:')) return blobUrl;
        try {
           const response = await fetch(blobUrl);
           const blob = await response.blob();
           return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
           });
        } catch (e) {
           console.error("Image convert failed", e);
           return null;
        }
     };

     const exportAsync = async () => {
        const dataUrl = await convertToDataURL(part.src);
        if (!dataUrl) {
           alert("画像の保存に失敗しました。");
           return;
        }

        const partData = {
           type: 'part_data',
           part: {
              ...part,
              src: dataUrl
           }
        };

        const blob = new Blob([JSON.stringify(partData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `part-${part.name || 'custom'}.json`; // パーツ名で保存
        a.click();
        URL.revokeObjectURL(url);
     };

     exportAsync();
  };

  // プロジェクト読み込み機能
  const loadProject = (file) => {
     if (!file) return;
     const reader = new FileReader();
     reader.onload = (e) => {
        try {
           const data = JSON.parse(e.target.result as string);
           // バージョンチェックやバリデーションが必要ならここで行う
           if (data.baseImg) setBaseImg(data.baseImg);
           if (data.parts) setParts(data.parts);
           if (data.zoom) setZoom(data.zoom);
           setSelectedPartId(null);
        } catch (error) {
           console.error("Load failed:", error);
           alert("ファイルの読み込みに失敗しました。");
        }
     };
     reader.readAsText(file);
  };
    
  // ファイル追加処理 (共通)
  const addPartFile = (file) => {
    if (!file) return;
    const initialSrc = URL.createObjectURL(file);
    const newPartId = crypto.randomUUID();

    const newPart = {
      id: newPartId,
      name: file.name, // ファイル名を追加
      src: initialSrc,
      originalSrc: initialSrc, // 自動透過前の元画像として保持
      mm: 150, // 初期サイズ
      metricType: 'width', // サイズ基準 ('width' | 'height')
      rotation: 0,
      flip: false,
      transparentMode: false, // 乗算モード廃止
      visible: true, // 可視性を追加
      position: { x: 50, y: 50 } // 初期位置
    };
    
    setParts(prev => [...prev, newPart]);
    setSelectedPartId(newPart.id);

    // 自動背景透過を実行 (一番明るい色を透過)
    processRemoving(initialSrc, (processedSrc) => {
        setParts(prev => prev.map(p => {
            if (p.id === newPartId) {
                return { ...p, src: processedSrc };
            }
            return p;
        }));
    });
  };

  // 画像ロード時やリサイズ時に表示サイズを取得してStateを更新
  const updateBaseImageSize = () => {
    if (baseImgRef.current) {
      setBaseImg(prev => ({ ...prev, widthPx: baseImgRef.current.width }));
    }
  };

  useEffect(() => {
    if (!baseImgRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
       updateBaseImageSize();
    });
    resizeObserver.observe(baseImgRef.current);
    return () => resizeObserver.disconnect();
  }, [baseImg.src]);

  const updateSelectedPart = (updates) => {
    if (!selectedPartId) return;
    setParts(prev => prev.map(p => p.id === selectedPartId ? { ...p, ...updates } : p));
  };
  
  const updatePart = (id, updates) => {
    setParts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteSelectedPart = () => {
    if (!selectedPartId) return;
    setParts(prev => prev.filter(p => p.id !== selectedPartId));
    setSelectedPartId(null);
  };
  
  const deletePart = (id) => {
    setParts(prev => prev.filter(p => p.id !== id));
    if (selectedPartId === id) setSelectedPartId(null);
  };

  const togglePartVisibility = (id) => {
    setParts(prev => prev.map(p => p.id === id ? { ...p, visible: p.visible === false ? true : false } : p));
  };
  
  const movePartLayer = (id, direction) => {
      setParts(prev => {
        const index = prev.findIndex(p => p.id === id);
        if (index === -1) return prev;
  
        const newParts = [...prev];
        if (direction === 'up') { // 前面へ (配列の後ろへ)
           if (index < newParts.length - 1) {
             [newParts[index], newParts[index + 1]] = [newParts[index + 1], newParts[index]];
           }
        } else if (direction === 'down') { // 背面へ (配列の前へ)
           if (index > 0) {
             [newParts[index], newParts[index - 1]] = [newParts[index - 1], newParts[index]];
           }
        }
        return newParts;
      });
  };

  const changePartOrder = (direction) => {
    if (!selectedPartId) return;
    setParts(prev => {
      const index = prev.findIndex(p => p.id === selectedPartId);
      if (index === -1) return prev;

      const newParts = [...prev];
      
      if (direction === 'top') {
        // 最前面 (配列の末尾へ)
        const [moved] = newParts.splice(index, 1);
        newParts.push(moved);
      } else if (direction === 'bottom') {
        // 最背面 (配列の先頭へ)
        const [moved] = newParts.splice(index, 1);
        newParts.unshift(moved);
      } else if (direction === 'up') {
        // 前面へ (一つ後ろと入れ替え)
        if (index < newParts.length - 1) {
          [newParts[index], newParts[index + 1]] = [newParts[index + 1], newParts[index]];
        }
      } else if (direction === 'down') {
        // 背面へ (一つ前と入れ替え)
        if (index > 0) {
          [newParts[index], newParts[index - 1]] = [newParts[index - 1], newParts[index]];
        }
      }
      return newParts;
    });
  };

  // ドロップ処理 (画像およびJSON)
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // JSONファイルの処理 (パーツデータ or プロジェクトデータ)
    const jsonFiles = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.name.toLowerCase().endsWith('.json'));
    if (jsonFiles.length > 0) {
       jsonFiles.forEach(file => {
          const reader = new FileReader();
          reader.onload = (ev) => {
             try {
                const data = JSON.parse(ev.target.result as string);
                // パーツデータの場合 (type: 'part_data')
                if (data.type === 'part_data' && data.part) {
                   const newPart = {
                      ...data.part,
                      id: crypto.randomUUID(), // IDは新しく振り直す
                      position: { x: 50, y: 50 }, // 位置はリセット
                      transparentMode: true, // 読み込んだものもデフォルトは透過にしておくか？ あるいは設定維持？ ここでは設定維持しつつデフォルトtrue
                      visible: true,
                      ...data.part // 上書き
                   };
                   // ただしJSONに保存されている値があればそれを優先したいので順番を調整
                   // いや、デフォルト透過にしてほしいなら、JSONにfalseが入っていても強制的にtrueにするべきか？
                   // ユーザーとしては「デフォルトで透過」と言っているので、新規追加時はtrue。
                   // しかしロード時は保存された状態を復元するのが筋。
                   // ここは「データにtransparentModeが含まれていなければtrue」とする。
                   if (newPart.transparentMode === undefined) newPart.transparentMode = true;

                   setParts(prev => [...prev, newPart]);
                }
                // プロジェクトデータの場合 (baseImgがあるかで簡易判定)
                else if (data.baseImg) {
                   if (confirm("プロジェクトファイルを読み込みますか？\n現在の作業内容は上書きされます。")) {
                      if (data.baseImg) setBaseImg({...data.baseImg, transparentMode: data.baseImg.transparentMode ?? true}); // 互換性のため
                      if (data.parts) setParts(data.parts.map(p => ({...p, transparentMode: p.transparentMode ?? true}))); // 互換性のため
                      if (data.zoom) setZoom(data.zoom);
                      setSelectedPartId(null);
                   }
                }
             } catch (err) {
                console.error("JSON Parse Error", err);
             }
          };
          reader.readAsText(file);
       });
       return;
    }

    // 画像ファイルの処理
    const files = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    // ベース画像がまだ設定されていない場合、最初の1枚をベース画像として扱う
    let startIdx = 0;
    if (!baseImg.src) {
      const src = URL.createObjectURL(files[0]);
      setBaseImg(prev => ({ ...prev, src, originalSrc: src, transparentMode: false }));
      
      // 自動背景透過
      processRemoving(src, (processedSrc) => {
         setBaseImg(prev => ({ ...prev, src: processedSrc }));
      });

      startIdx = 1; // 1枚目は消費したので次から
    }

    // 残りのファイルをパーツとして追加
    for (let i = startIdx; i < files.length; i++) {
      addPartFile(files[i]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 背景透過処理 (簡易版)
  const processRemoveBackground = (partId) => {
    const part = parts.find(p => p.id === partId);
    if (!part) return;

    if (!confirm("自動背景透過を実行しますか？\n(最も明るい色を透過します)")) return;

    processRemoving(part.src, (newSrc) => {
        updatePart(partId, {
            src: newSrc,
            originalSrc: part.originalSrc || part.src // 元画像がなければ今のを保存
        });
    });
  };

  const processRemoveBackgroundBase = () => {
    if (!baseImg.src) return;

    if (!confirm("本体画像の自動背景透過を実行しますか？\n(最も明るい色を透過します)")) return;

    processRemoving(baseImg.src, (newSrc) => {
        setBaseImg(prev => ({
            ...prev,
            src: newSrc,
            originalSrc: prev.originalSrc || prev.src
        }));
    });
  };

  function processRemoving(src: string, callback: (newSrc: string) => void) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = src;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // 最も明るい色を探索して背景色とする
        let maxBrightness = -1;
        let bgR = 255;
        let bgG = 255;
        let bgB = 255;

        for (let i = 0; i < data.length; i += 4) {
            // 透明度が低いピクセルは無視
            if (data[i+3] < 10) continue;

            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            
            // 輝度計算 (Rec. 601)
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            
            if (brightness > maxBrightness) {
                maxBrightness = brightness;
                bgR = r;
                bgG = g;
                bgB = b;
            }
        }

        const threshold = 40; // 閾値

        for (let i = 0; i < data.length; i += 4) {
           const r = data[i];
           const g = data[i+1];
           const b = data[i+2];

           // 色差計算 (ユークリッド距離)
            const diff = Math.sqrt(
                Math.pow(r - bgR, 2) +
                Math.pow(g - bgG, 2) +
                Math.pow(b - bgB, 2)
            );

            if (diff < threshold) {
                data[i+3] = 0; // 透明化
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        callback(canvas.toDataURL());
    };
  };

  // 背景透過のリセット
  const restoreOriginalImage = (partId) => {
      const part = parts.find(p => p.id === partId);
      if (part && part.originalSrc) {
          if (!confirm("元の画像に戻しますか？")) return;
          updatePart(partId, {
              src: part.originalSrc,
              originalSrc: null
          });
      }
  };

  const restoreOriginalImageBase = () => {
      if (baseImg.originalSrc) {
          if (!confirm("元の画像に戻しますか？")) return;
          setBaseImg(prev => ({
              ...prev,
              src: prev.originalSrc!,
              originalSrc: null
          }));
      }
  };

  // スケール計算: 1mmあたりのピクセル数
  const baseScale = (baseImg.widthPx > 0 && Number(baseImg.mm) > 0) ? baseImg.widthPx / Number(baseImg.mm) : 1;
  
  const selectedPart = parts.find(p => p.id === selectedPartId);

  return (
    <main className="p-8 max-w-6xl mx-auto select-none">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
         <h1 className="text-3xl font-bold flex items-center gap-2">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            Airsoft Scale Simulator
         </h1>
         <div className="flex gap-2">
           {/* 保存・読込ボタン */}
           <input 
             type="file" 
             ref={fileInputRef}
             accept=".json"
             className="hidden"
             onChange={(e) => {
                 if (e.target.files?.[0]) {
                     loadProject(e.target.files[0]);
                     e.target.value = ''; // Reset
                 }
             }}
           />
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded shadow transition-all text-sm font-bold flex items-center gap-1"
           >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              読込
           </button>
           <button 
             onClick={saveProject}
             className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded shadow transition-all text-sm font-bold flex items-center gap-1"
           >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              保存
           </button>
         </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 mb-8 items-start">
        {/* 左カラム：パーツ設定 & ズーム */}
        <div className="w-full md:w-64 flex flex-col gap-6 shrink-0">
          
          {/* パーツ設定 (コントロールパネル) */}
          <div className="p-4 bg-white shadow rounded-lg border flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
               <h2 className="text-xl font-semibold text-green-600">パーツ設定</h2>
               {/* パーツ追加ボタン */}
               <label className="cursor-pointer bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors">
                 + 追加
                 <input 
                   type="file" 
                   accept="image/*"
                   onChange={(e) => addPartFile(e.target.files[0])} 
                   className="hidden"
                 />
               </label>
            </div>

            <div className="flex-1 overflow-y-auto">
               <h3 className="text-sm font-bold text-gray-600 mb-2 pb-1 border-b">レイヤー順 (前面が上)</h3>
               {parts.length === 0 ? (
                 <p className="text-gray-400 text-sm py-4 text-center">パーツを追加してください</p>
               ) : (
                 <ul className="flex flex-col gap-1 pb-2" onDragLeave={() => setDragOverInfo({ id: null, position: null })}>
                   {[...parts].reverse().map((part) => (
                     <li 
                       key={part.id} 
                       className={`relative flex items-center gap-2 p-2 rounded border cursor-move transition-all
                         ${selectedPartId === part.id ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'}
                         ${dragOverInfo.id === part.id && dragOverInfo.position === 'top' ? 'border-t-4 border-t-red-500 pt-[calc(0.5rem-2px)]' : ''}
                         ${dragOverInfo.id === part.id && dragOverInfo.position === 'bottom' ? 'border-b-4 border-b-red-500 pb-[calc(0.5rem-2px)]' : ''}
                       `}
                       onClick={() => setSelectedPartId(part.id)}
                       draggable={true}
                       onDragStart={(e) => {
                         e.dataTransfer.setData('partId', part.id);
                         e.dataTransfer.effectAllowed = 'move';
                       }}
                       onDragOver={(e) => {
                         e.preventDefault();
                         e.dataTransfer.dropEffect = 'move';
                         const rect = e.currentTarget.getBoundingClientRect();
                         const y = e.clientY - rect.top;
                         const position = y < rect.height / 2 ? 'top' : 'bottom';
                         if (dragOverInfo.id !== part.id || dragOverInfo.position !== position) {
                            setDragOverInfo({ id: part.id, position });
                         }
                       }}
                       onDrop={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         const draggedId = e.dataTransfer.getData('partId');
                         const { position } = dragOverInfo;
                         setDragOverInfo({ id: null, position: null });

                         if (draggedId && draggedId !== part.id && position) {
                            setParts(prev => {
                               const fromIndex = prev.findIndex(p => p.id === draggedId);
                               let toIndex = prev.findIndex(p => p.id === part.id);
                               if (fromIndex === -1 || toIndex === -1) return prev;
                               const newParts = [...prev];
                               const [moved] = newParts.splice(fromIndex, 1);
                               if (fromIndex < toIndex) toIndex -= 1;
                               const insertIndex = position === 'top' ? toIndex + 1 : toIndex;
                               newParts.splice(insertIndex, 0, moved);
                               return newParts;
                            });
                         }
                       }}
                     >
                       <div className="w-10 h-10 bg-gray-100 rounded flex-shrink-0 overflow-hidden border pointer-events-none">
                         <img src={part.src} className="w-full h-full object-contain" alt="" />
                       </div>
                       <div className="flex-1 min-w-0 pointer-events-none">
                         <p className="text-sm font-medium truncate">{part.name || 'パーツ'}</p>
                       </div>
                       <div className="flex flex-col gap-1">
                         <button 
                           onClick={(e) => { e.stopPropagation(); togglePartVisibility(part.id); }}
                           className={`p-1 rounded ${part.visible !== false ? 'text-gray-600 hover:bg-gray-200' : 'text-gray-300 hover:bg-gray-100'}`}
                           title={part.visible !== false ? '非表示にする' : '表示する'}
                         >
                           {part.visible !== false ? (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                           ) : (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                           )}
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); deletePart(part.id); }}
                           className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                           title="削除"
                         >
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                       </div>
                     </li>
                   ))}
                 </ul>
               )}
            </div>
          </div>

          {/* 表示ズーム */}
          <div className="p-4 bg-white shadow rounded-lg border">
            <p className="text-sm font-semibold mb-2 text-gray-700">表示ズーム</p>
            <div className="flex items-center gap-1">
               <span className="text-[10px] text-gray-500 whitespace-nowrap">縮小</span>
               <input 
                  type="range" 
                  min="0.2" 
                  max="2.0" 
                  step="0.1"
                  value={zoom} 
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 min-w-0"
               />
               <span className="text-[10px] text-gray-500 whitespace-nowrap">拡大</span>
               <div className="flex items-center ml-1 shrink-0">
                 <input 
                   type="number" 
                   step="0.1"
                   value={zoom}
                   onChange={(e) => setZoom(Number(e.target.value))}
                   className="w-12 border rounded px-1 py-0.5 text-right text-xs"
                 />
                 <span className="text-xs ml-0.5">倍</span>
               </div>
            </div>
            <div className="text-center mt-1">
               <button onClick={() => setZoom(1.0)} className="text-xs text-blue-500 hover:underline">リセット</button>
            </div>
          </div>

        </div>

        {/* 右カラム (メイン) */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          
          {/* 本体ファイルアップロード (シンプル化) */}
          <div className="bg-white p-3 rounded-lg shadow border flex items-center gap-4">
             <span className="text-sm font-bold text-blue-600 whitespace-nowrap">本体画像:</span>
             <label className="cursor-pointer bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200 text-xs font-semibold hover:bg-blue-100 transition-colors flex max-w-[200px] truncate">
                 {baseImg.src ? '画像を変更...' : '画像を選択...'}
                 <input 
                   type="file" 
                   accept="image/*"
                   onChange={(e) => {
                       if (e.target.files?.[0]) {
                           const src = URL.createObjectURL(e.target.files[0]);
                           setBaseImg({...baseImg, src, originalSrc: src, transparentMode: false});
                           
                           // 自動背景透過
                           processRemoving(src, (processedSrc) => {
                               setBaseImg(prev => ({ ...prev, src: processedSrc }));
                           });
                       }
                   }} 
                   className="hidden"
                 />
             </label>
             {baseImg.src && (
                  <button onClick={() => setBaseImg({...baseImg, src: null})} className="text-xs text-red-400 hover:text-red-600">解除</button>
             )}
          </div>

          {/* シミュレーション画面 */}
          <div 
            ref={containerRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => { setSelectedPartId(null); setIsBaseSelected(false); }} 
            className="relative border-4 border-dashed border-gray-300 bg-gray-100 rounded-xl overflow-hidden min-h-[600px] flex items-center justify-center transition-colors hover:bg-gray-50"
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', width: 'fit-content', height: 'fit-content', position: 'relative' }}>
            {!baseImg.src && (
                <div className="text-center p-10 pointer-events-none">
                    <p className="text-gray-400 text-xl font-bold mb-2">ここに本体画像をドロップ</p>
                    <p className="text-gray-400 text-sm">または上の「本体画像」からアップロード</p>
                </div>
            )}
        
        {baseImg.src && (
          <Draggable
            nodeRef={baseDraggableRef}
            scale={zoom}
          >
            <div 
               ref={baseDraggableRef} 
               className={`cursor-move relative inline-block z-0 ${isBaseSelected ? 'ring-2 ring-blue-500 shadow-xl' : ''}`}
               onClick={(e) => {
                   e.stopPropagation();
                   setIsBaseSelected(true);
                   setSelectedPartId(null);
               }}
            >
              <img 
                ref={baseImgRef}
                src={baseImg.src} 
                onLoad={updateBaseImageSize}
                className="max-w-full max-h-full object-contain shadow-lg"
                style={{ 
                  transform: `scaleX(${baseImg.flip ? -1 : 1})`
                }}
                alt="Base"
                draggable={false}
              />

              {/* 本体用ミニパネル */}
              {isBaseSelected && (
                <div 
                   className="absolute top-full left-1/2 mt-8 bg-white p-3 rounded-lg shadow-xl border border-blue-500 flex flex-col gap-2"
                   style={{  
                     width: 'max-content',
                     minWidth: '200px',
                     maxWidth: '90vw',
                     transform: `translateX(-50%) scale(${1/zoom})`, // 中央寄せ + ズーム相殺
                     transformOrigin: 'top center', // パネル上辺を基準に
                     zIndex: 1000,
                     cursor: 'default'
                   }}
                   onMouseDown={(e) => e.stopPropagation()}
                   onClick={(e) => e.stopPropagation()}
                   onPointerDown={(e) => e.stopPropagation()}
                 >
                    {/* パネルと画像をつなぐ線 */}
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-blue-500 pointer-events-none"></div>

                    <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-gray-700 whitespace-nowrap">本体全長(実寸)</span>
                       <input 
                         type="number" 
                         value={baseImg.mm} 
                         onChange={(e) => setBaseImg({...baseImg, mm: (e.target.value === '' ? '' : Number(e.target.value)) as any})} 
                         className="border border-gray-300 bg-white/90 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 font-bold text-black text-right w-24"
                       />
                       <span className="text-sm font-bold text-gray-700">mm</span>
                    </div>

                     {/* 機能ボタン */}
                     <div className="flex items-center gap-2 border-t border-gray-200 pt-2 mt-1">
                        <label className="flex items-center gap-2 cursor-pointer w-full hover:bg-gray-50 p-1 rounded">
                           <input 
                             type="checkbox" 
                             checked={baseImg.flip || false} 
                             onChange={(e) => setBaseImg(prev => ({ ...prev, flip: e.target.checked }))}
                             className="w-4 h-4 accent-blue-600 rounded"
                           />
                           <span className="text-xs font-bold text-gray-700">左右反転</span>
                        </label>
                     </div>
                     
                     <div className="border-t border-gray-200 pt-2 mt-1">
                         <button
                            onClick={(e) => {
                               e.stopPropagation();
                               if (baseImg.originalSrc) {
                                  restoreOriginalImageBase();
                               } else {
                                  processRemoveBackgroundBase();
                               }
                            }}
                            className={`w-full text-xs px-2 py-1.5 rounded shadow flex items-center justify-center gap-1 ${baseImg.originalSrc ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-purple-600 hover:bg-purple-700'} text-white font-bold transition-colors`}
                            title={baseImg.originalSrc ? "元画像に戻す" : "背景色を透過 (左上が基準)"}
                         >
                            {baseImg.originalSrc ? (
                               <>
                                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                 元画像に戻す
                               </>
                            ) : (
                               <>
                                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                 自動背景透過 (左上基準)
                               </>
                            )}
                         </button>
                     </div>

                    <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-1 gap-2">
                        <button 
                            onClick={() => setExtractMode({ src: baseImg.src, targetType: 'base' })}
                            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l-7-7m7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm8.486-8.486a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243z" /></svg>
                            パーツ切り出し
                        </button>
                    </div>
                </div>
              )}
              
              {/* パーツを本体の子要素として配置し、一緒に移動するようにする */}
              {parts.map(part => (
                <DraggablePart 
                  key={part.id} 
                  part={part} 
                  scale={baseScale} 
                  zoom={zoom}
                  onSelect={(id) => { setSelectedPartId(id); setIsBaseSelected(false); }}
                  isSelected={selectedPartId === part.id}
                  updatePart={updatePart}
                  containerRef={containerRef}
                  onExport={exportSelectedPart}
                  onRemoveBg={() => processRemoveBackground(part.id)}
                  onRestore={() => restoreOriginalImage(part.id)}
                  onPerspective={() => startPerspective(part)}
                />
              ))}
            </div>
          </Draggable>
        )}
        </div>

        {baseImg.src && parts.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <p className="text-gray-400/50 text-2xl font-bold rotate-[-15deg]">パーツ画像をここにドロップ</p>
            </div>
        )}
        
        <PerspectiveOverlay 
           perspectiveMode={perspectiveMode} 
           setPerspectiveMode={setPerspectiveMode} 
           onApply={applyPerspective} 
           extractMode={extractMode}
           setExtractMode={setExtractMode}
           onCreatePart={handleCreatePart}
        />
      </div>
        </div>
      </div>
      
      <p className="text-center mt-4 text-gray-500 italic text-sm">
        パーツ画像ファイルを画面にドラッグ＆ドロップして追加できます。
      </p>
    </main>
  );
}
