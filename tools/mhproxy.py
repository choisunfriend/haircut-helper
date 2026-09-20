"""MakeHuman 프록시(JSON) → 우리 표준 체형에 맞춘 OBJ.
   의상 정점이 베이스 메쉬 삼각형 3개(ref_vIdxs)에 무게중심 좌표(weights)로 물려 있어서,
   몸이 바뀌면 그 식을 다시 풀기만 하면 옷이 따라온다. conform으로 밀어내는 것과 달리
   원래 만든 사람이 의도한 자리에 정확히 붙는다 — 이게 나중에 고객 체형 변형까지 가는 길이다."""
import json, numpy as np

def load_proxy(path):
    d = json.load(open(path))
    ref = np.array(d['ref_vIdxs'], dtype=int)
    w   = np.array(d['weights'], dtype=float)
    off = np.array(d['offsets'], dtype=float)
    faces = parse_faces(d['faces'])
    return ref, w, off, faces

def parse_faces(a):
    """three.js 레거시 JSON 페이스 배열 — 비트마스크로 무엇이 붙어 있는지 정해진다."""
    out=[]; i=0; n=len(a)
    while i < n:
        t = a[i]; i += 1
        quad   = t & 1
        nv     = 4 if quad else 3
        idx    = a[i:i+nv]; i += nv
        if t & 2:  i += 1                      # face material
        if t & 4:  i += 1                      # face uv
        if t & 8:  i += nv                     # face vertex uv
        if t & 16: i += 1                      # face normal
        if t & 32: i += nv                     # face vertex normal
        if t & 64: i += 1                      # face color
        if t & 128:i += nv                     # face vertex color
        out.append(list(idx))
    return out

def fit_to_body(ref, w, off, BodyV):
    """BodyV = hm08 전체 정점(19158개) 배열. ref 인덱스가 여기를 가리킨다."""
    P = (BodyV[ref[:,0]]*w[:,0:1] + BodyV[ref[:,1]]*w[:,1:2] + BodyV[ref[:,2]]*w[:,2:3])
    return P + off
