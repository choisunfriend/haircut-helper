import numpy as np

def load_obj(path, want_groups=None):
    V=[]; faces=[]; g=None
    for l in open(path, errors='ignore'):
        if l.startswith('v '):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('g '):
            g=l[2:].strip()
        elif l.startswith('o '):
            g=l[2:].strip()
        elif l.startswith('f '):
            if want_groups and g not in want_groups: continue
            faces.append([int(t.split('/')[0])-1 for t in l.split()[1:]])
    return np.array(V,dtype=float), faces

def compact(V, faces):
    used=sorted({i for f in faces for i in f})
    remap={o:n for n,o in enumerate(used)}
    return V[used], [[remap[i] for i in f] for f in faces]

def vnormals(V, faces):
    N=np.zeros_like(V)
    for f in faces:
        for k in range(len(f)-2):
            a,b,c=V[f[0]],V[f[k+1]],V[f[k+2]]
            n=np.cross(b-a,c-a)
            for i in (f[0],f[k+1],f[k+2]): N[i]+=n
    ln=np.linalg.norm(N,axis=1,keepdims=True); ln[ln==0]=1
    return N/ln

def write_obj(path, V, faces, N=None, name='Body', mtl=None, usemtl=None, header=''):
    with open(path,'w') as fh:
        if header: fh.write(header)
        if mtl: fh.write('mtllib %s\n'%mtl)
        fh.write('o %s\n'%name)
        for v in V: fh.write('v %.4f %.4f %.4f\n'%tuple(v))
        if N is not None:
            for n in N: fh.write('vn %.3f %.3f %.3f\n'%tuple(n))
        if usemtl: fh.write('usemtl %s\n'%usemtl)
        for f in faces:
            if N is not None:
                fh.write('f '+' '.join('%d//%d'%(i+1,i+1) for i in f)+'\n')
            else:
                fh.write('f '+' '.join(str(i+1) for i in f)+'\n')
