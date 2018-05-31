const fsSrc = `
	precision highp float;

	uniform mat4 uMV;
	uniform vec3 cameraPos;
	uniform float focalLength;
	uniform vec2 windowSize;
	uniform samplerCube envMap;
	uniform float time;

	varying vec3 pos;

	#define MIN_DIST .05
	#define MAX_STEPS 64
	#define PI 3.14159
	#define EPSILON .0001
	#define SPECULAR_EXPONENT 20.
	#define FAR 100.
	#define NUM_METABALLS 2
	#define ISOPOTENTIAL .4

	vec2 intersect(vec2 a, vec2 b) {
		return a.x > b.x ? a : b;
	}
	vec2 _union(vec2 a, vec2 b) {
		return a.x < b.x ? a : b;
	}
	vec2 diff(vec2 a, vec2 b) {
		return a.x > -b.x ? a : b;
	}
	float sphereSDF(vec3 p, vec3 c, float r) {
		return length(p - c) - r;
	}
	float metaballSDF(vec3 p) {
		float sumDensity = 0.;
		float sumRi = 0.;
		float minDist = FAR;
		vec3 centers[NUM_METABALLS]; centers[0] = vec3(0.); centers[1] = vec3(cos(time * .5));
		float radii[NUM_METABALLS]; radii[0] = .5; radii[1] = .5;
		float r = 0.;
		for(int i = 0; i < NUM_METABALLS; ++i) {
			r = length(centers[i] - p);
			if(r <= radii[i])
				sumDensity += 2. * (r * r * r) / (radii[i] * radii[i] * radii[i]) - 3. * (r * r) / (radii[i] * radii[i]) + 1.;
			minDist = min(minDist, r - radii[i]);
			sumRi += 1.;
		}
		return max(minDist, (ISOPOTENTIAL - sumDensity) / (1.5 * sumRi));
	}
	float roundBoxSDF(vec3 p, vec3 b, float r) {
		return length(max(abs(p) - b, 0.)) - r;
	}
	vec2 idShape(float dist, int id) {
		return vec2(dist, id);
	}
	vec2 sceneSDF(vec3 p) {
		vec2 box = idShape(roundBoxSDF(p, vec3(1.5), .1), 1);
		vec2 horiz = idShape(roundBoxSDF(p, vec3(1.6, 1., 1.), .1), -1);
		vec2 vert = idShape(roundBoxSDF(p, vec3(1., 1.6, 1.), .1), -1);
		vec2 zed = idShape(roundBoxSDF(p, vec3(1., 1., 1.6), .1), -1);
		vec2 mergebox = diff(diff(diff(box, horiz), vert), zed);
		vec2 bubble_bounds = idShape(roundBoxSDF(p, vec3(1), .1), -1);
		if(mergebox.y == -1.)
			return idShape(metaballSDF(p), 0);
		return mergebox;
	}
	vec3 getRd(vec2 fragCoord, float fov) {
		vec2 uv = 2. * fragCoord / windowSize - 1.;
		fov = fov * PI / 180.;
		float focal = 1. / tan(fov / 2.);
		return normalize(vec3(uv, focal));
	}
	vec2 raymarch(vec3 ro, vec3 rd) {
		float dist = MIN_DIST;
		vec2 objID = vec2(0.);
		for(int i = 0; i < MAX_STEPS; ++i) {
			if(dist > FAR)
				break;
			if((objID = sceneSDF(ro + rd * dist)).x <= EPSILON)
				return vec2(dist, objID.y);
			dist += objID.x;
		}
		return vec2(dist, -1);
	}
	vec3 getNormal(vec3 iXPos) {
		vec2 diff = vec2(EPSILON, 0.);
		return normalize(vec3(
		                 sceneSDF(iXPos + diff.xyy).x - sceneSDF(iXPos - diff.xyy).x,
		                 sceneSDF(iXPos + diff.yxy).x - sceneSDF(iXPos - diff.yxy).x,
		                 sceneSDF(iXPos + diff.yyx).x - sceneSDF(iXPos - diff.yyx).x
		       ));
	}
	vec3 blinn_phong(vec3 n, vec3 l, vec3 eye) {
		vec3 r = -reflect(l, n);
		return vec3(1.) * pow(max(0., dot(r, eye)), SPECULAR_EXPONENT);
	}
	vec3 env_map(vec3 n, vec3 eye) {
		vec3 r = -reflect(eye, n);
		return textureCube(envMap, r).rgb;
	}
	vec3 diffuse(vec3 n, vec3 l) {
		return vec3(.7, .8, .4) * max(0., dot(n,l));
	}
	vec3 gamma_correct(vec3 col, float expon) {
		return vec3(pow(col.r, expon), pow(col.g, expon), pow(col.b, expon));
	}
	mat3 lookAt(vec3 eye) {
		vec3 strafe = cross(vec3(0, 1, 0), eye);
		vec3 up = cross(eye, strafe);
		mat3 view = mat3(0.);
		return mat3(normalize(strafe),
                normalize(up),
		            normalize(eye));
	}
	void main() {
		vec3 rd = getRd(gl_FragCoord.xy, 35.);
		float timestep = time * .5;
		vec3 ro = -7. * vec3(sin(timestep), 0, cos(timestep));
		mat3 view = lookAt(vec3(0.) - ro);
		rd = view * rd;
		vec2 objID = raymarch(ro, rd);
		float dist = objID.x;
		float type = objID.y;
		float infore = float(dist <= FAR) * float(type >= 0.);
		float isbox = float(type > 0.);
		vec3 col = (1. - isbox) * vec3(infore) + isbox * vec3(.7, .5, .2);
		vec3 iXPos = ro + rd * dist;
		vec3 n = getNormal(iXPos);
		vec3 toplight = view * vec3(0., 5., 3.);
		vec3 bottomlight = view * vec3(0., -5., 3.);
		vec3 topl = normalize(toplight - iXPos);
		vec3 bottoml = normalize(bottomlight - iXPos);
		vec3 highlights = blinn_phong(n, topl, -rd) + blinn_phong(n, bottoml, -rd) + blinn_phong(n, -rd, -rd);
		vec3 back = textureCube(envMap, rd).rgb;
		if(type == 0.) {
			col *= mix(highlights, env_map(n, -rd), .2) + 0.4;
			col = (1. - infore) * back + infore * mix(back, col, .5);
		} else {
			col *= diffuse(n, -rd) + highlights;
			col = (1. - infore) * back + infore * col;
		}
		gl_FragColor = vec4(col, 1.);
	}
`;
