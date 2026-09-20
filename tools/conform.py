"""반입 파이프라인 — 기증받은 의상 메쉬를 표준 인체 밖으로 밀어내 맞춘다.
   몸을 뚫고 들어간 자리만 바깥으로 밀고, 그 변위를 옷 표면 위에서 부드럽게 퍼뜨려
   옷 모양(주름·라펠·실루엣)은 그대로 두면서 몸이 비어져 나오지 않게 한다."""
import numpy as np, objlib
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix

def surface_samples(V, F):
    N = objlib.vnormals(V, F)
    pts=[V]; nrm=[N]
    for f in F:
        i=np.array(f)
        pts.append(V[i].mean(0)[None,:]); nrm.append(N[i].mean(0)[None,:])
        for k in range(len(i)):
            a,b=i[k],i[(k+1)%len(i)]
            pts.append(((V[a]+V[b])/2)[None,:]); nrm.append(((N[a]+N[b])/2)[None,:])
    P=np.vstack(pts); M=np.vstack(nrm)
    M/=np.maximum(np.linalg.norm(M,axis=1,keepdims=True),1e-9)
    return P,M

def adjacency(n, F):
    r=[];c=[]
    for f in F:
        for k in range(len(f)):
            a,b=f[k],f[(k+1)%len(f)]
            r+= [a,b]; c+= [b,a]
    A=coo_matrix((np.ones(len(r)),(r,c)),shape=(n,n)).tocsr()
    A.data[:]=1.0
    deg=np.asarray(A.sum(1)).ravel(); deg[deg==0]=1
    return A, deg

def smooth(D, A, deg, iters, w=0.65):
    for _ in range(iters):
        D = (1-w)*D + w*(A@D)/deg[:,None]
    return D

def conform(gpath, body_pts, body_nrm, clearance=0.06, rounds=6, smooth_iters=14):
    G,GF = objlib.load_obj(gpath)
    A,deg = adjacency(len(G), GF)
    tree = cKDTree(body_pts)
    for r in range(rounds):
        d,i = tree.query(G, workers=-1)
        nb = body_nrm[i]
        signed = np.einsum('ij,ij->i', G-body_pts[i], nb)
        need = clearance - signed
        push = np.where(need>0, need, 0.0)[:,None]*nb
        if not push.any(): break
        G = G + smooth(push, A, deg, smooth_iters)
    d,i = tree.query(G, workers=-1)
    signed = np.einsum('ij,ij->i', G-body_pts[i], body_nrm[i])
    return G, GF, signed

if __name__=='__main__':
    BV,BF = objlib.load_obj('repo/assets/body_makehuman.obj')
    BP,BN = surface_samples(BV,BF)
    import sys
    for name,cl in [('suit3',0.06),('suit_dinner_jacket',0.06),('fem_suit2',0.06),
                    ('mycenaean_tunic',0.06),('mens_elv_jeans2slf',0.025)]:
        G,GF,sg = conform('repo/assets/%s.obj'%name, BP, BN, clearance=cl)
        print('%-20s 뚫린 정점 %5d → %5d (최악 %.3f → %.3f)'%(
            name, 0,(sg<0).sum(), 0, sg.min()))
        objlib.write_obj('repo/assets/fitted/%s.fitted.obj'%name, G, GF,
            N=objlib.vnormals(G,GF), name=name,
            header='# %s — 표준 인체(body_makehuman)에 맞춰 반입 단계에서 conform한 사본\n'
                   '# 원본: assets/%s.obj (CC0, MakeClothes)\n'%(name,name))

def conform_normals(gpath, BP, BN, clearance=0.06, rounds=12, smooth_iters=12):
    """몸 안으로 들어간 옷 정점을 옷 자신의 바깥 법선으로 밀어내고, 변위를 옷 위에서 부드럽게 퍼뜨린다."""
    from scipy.spatial import cKDTree
    G,GF = objlib.load_obj(gpath)
    A,deg = adjacency(len(G), GF)
    tree = cKDTree(BP)
    for _ in range(rounds):
        NG = objlib.vnormals(G, GF)
        _,i = tree.query(G, workers=-1)
        signed = np.einsum('ij,ij->i', G-BP[i], BN[i])
        need = np.where(clearance-signed>0, clearance-signed, 0.0)
        G = G + smooth(need[:,None]*NG, A, deg, smooth_iters)
    _,i = tree.query(G, workers=-1)
    return G, GF, np.einsum('ij,ij->i', G-BP[i], BN[i])
