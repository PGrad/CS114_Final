const glstate = new gl_state();
function getGLContext() {
	const canvas = document.querySelector("#glCanvas");
	if(!canvas) {
		console.log("Error getting canvas");
		return undefined;
	}
	return glstate.get_webgl_context(canvas);
}

var defaultindexvalue = {
	"rindex": 1.5,
	"gindex": 1.7,
	"bindex": 1.7
};

var firstswitch = true;
function switchGlassSliders(enabled) {
	const sliders = document.getElementsByClassName("refraction-glass");
	const blockstyle = enabled ? "block" : "none";
	for(var i = 0; i < sliders.length; ++i)
		sliders[i].style.display = blockstyle;
	if(firstswitch) {
		setdefault('gindex');
		setdefault('bindex');
		firstswitch = false;
	}
}

function getSliderValue(index) {
	const slider = document.getElementById(index);
	return slider ? slider.value : defaultindexvalue[index];
}

function setSliderAnno(val, index) {
	const sliderright = document.getElementById(index + "value");
	return sliderright.innerHTML = val;
}

function setSlider(props) {
	if(props.val)
		setSliderAnno(setSliderValue(props.val, props.index), props.index);
	else
		setSliderAnno(getSliderValue(props.index), props.index);
}

function setdefault(index) {
	setSlider({ val: defaultindexvalue[index], index: index});
}

function setSliderValue(val, index) {
	const slider = document.getElementById(index);
	return slider.value = val;
}

function resize(gl) {
	let displayWidth = document.documentElement.clientWidth * .4;
	let displayHeight = displayWidth;
	if(gl.canvas.width != displayWidth || gl.canvas.height != displayHeight) {
		gl.canvas.width = document.documentElement.clientWidth * .4;
		gl.canvas.height = gl.canvas.width;
	}
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

var gl;
function gl_state() {
	const webgl_versions = ["webgl2", "webgl", "experimental-webgl"];
	function* wherestopper() {
		for(var i = 0; i < 3; ++i)
			yield webgl_versions[i];
	}
	const webgl_version_wherestopper = wherestopper();
	this.get_webgl_version = () => {
		if(webgl_version_wherestopper.next().value == "webgl")
			return 2;
		if(webgl_version_wherestopper.next().value == "experimental-webgl")
			return 1;
		return 0;
	}
	this.get_webgl_context = (canvas) => {
		for(var i = 0; i < 3; ++i)
			if((gl = canvas.getContext(webgl_version_wherestopper.next().value)))
				return gl;
		return null;
	}
}

function Time() {
	let time = 0
	let last_time = 0;
	let play = true;
	let delta = 0;
	let frames = 0;
	let seccount = 0;
	let frametimerEl = document.getElementById("frametimer");
	let framecountEl = document.getElementById("framecount");
	this.getTime = () => {
		if(play)
			last_time += delta;
		return last_time;
	};
	this.setDelta = (frametime) => {
		frametime *= .001;
		delta = frametime - time;
		this.frameCount(delta * 1000);
		time = frametime;
	};
	this.setPlay = (canPlay) => {
		play = canPlay;
	};
	this.frameCount = (delta) => {
		++frames;
		seccount += delta;
		if(seccount >= 1000.) {
			frametimerEl.innerHTML = (seccount / frames).toFixed(2);
			framecountEl.innerHTML = frames;
			seccount = frames = 0;
		}
	};
}

function initShaderProgram(gl, vsSrc, fsSrc) {
	const vShader = loadShader(gl, gl.VERTEX_SHADER, vsSrc);
	const fShader = loadShader(gl, gl.FRAGMENT_SHADER, commonSrc + fsSrc);

	if(!vShader || !fShader)
		return null;

	const shaderProg = gl.createProgram();
	gl.attachShader(shaderProg, vShader);
	gl.attachShader(shaderProg, fShader);
	gl.linkProgram(shaderProg);

	if(!gl.getProgramParameter(shaderProg, gl.LINK_STATUS)) {
		console.log("Cannot init shader program" + gl.getProgramInfoLog(shaderProg));
		gl.deleteProgram(shaderProg);
		return null;
	}

	return shaderProg;
}

function switchShader(type) {
	loadNewFShader(type == "bubble" ? bubbleFsSrc : glassFsSrc);
	switchGlassSliders(type == "glass" ? true : false);
	switchRIndex(type);
}

var bubbleRindex = 1.5;
var glassRindex = 1.5;

function switchRIndex(type) {
	const slider = document.getElementById("rindex");
	if(type == 'glass') {
		bubbleRindex = slider.value;
		setSlider({ val : glassRindex, index : 'rindex'});
		slider.style.setProperty("--rindex-color", "#ff0000");
	}
	else if(type == 'bubble') {
		glassRindex = slider.value;
		setSlider({ val : bubbleRindex, index : 'rindex' });
		slider.style.setProperty("--rindex-color", "#ffffff");
	}
}

function loadNewFShader(fshaderName) {
	shaderProg = initShaderProgram(gl, vsSrc, fshaderName);
	programInfo = getProgramInfo(gl, shaderProg);
}

function loadShader(gl, type, src) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, src);
	gl.compileShader(shader);

	if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.log(gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

const NUM_FACES = 6;
function loadCubemap(gl, img_path, img_paths) {
	const texture = gl.createTexture();
	const pixel = new Uint8Array([0, 0, 255, 255]);
	load_cubemap_textures(gl, texture, null, pixel);
	img_paths = img_paths.map(x => img_path + x);
	let promises = [];
	for(var i = 0; i < NUM_FACES; ++i)
		promises.push(loadImg(img_paths[i]));
	return Promise.all(promises).then((images) => {
		if(load_cubemap_textures(gl, texture, images))
			Promise.resolve("Textures loaded");
		else
			Promise.reject("Can't load textures!");
	}, (err) => {
		Promise.reject(err);
	});
}

function createAndLoadTexture(gl, img_path) {
	const texture = gl.createTexture();
	const pixel = new Uint8Array([0, 0, 255, 255]);
	load_texture(gl, texture, null, pixel);
	return loadImg(img_path).then((img) => {
		if(load_texture(gl, texture, img))
			Promise.resolve("Textures loaded");
		else
			Promise.reject("Can't load textures!");
	}, (err) => {
		Promise.reject(err);
	});
}

function loadImg(img_name) {
	const image = new Image();
	const prom = new Promise((resolve, reject) => {
		image.onload = () => {
			resolve(image);
		};
		image.onerror = (err) => {
			console.log(err);
			reject(err || "Cannot load image");
		};
	});
	image.src = img_name;
	return prom;
}

function load_cubemap_textures(gl, texture, face_imgs, dummy = undefined) {
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
	let use_dummy = false;
	if((use_dummy = !face_imgs)) {
		if(dummy) {
			face_imgs = [];
			for(var i = 0; i < NUM_FACES; ++i)
				face_imgs.push(dummy);
		} else {
			console.log("No textures provided.");
			return false;
		}
	}
	const face_types = [gl.TEXTURE_CUBE_MAP_POSITIVE_X,
	                    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
	                    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
	                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
	                    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
	                    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z];
	if(use_dummy)
		for(var i = 0; i < NUM_FACES; ++i)
			gl.texImage2D(face_types[i], 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, dummy);
	else {
		for(var i = 0; i < NUM_FACES; ++i)
			gl.texImage2D(face_types[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, face_imgs[i]);
		config_textures(gl, gl.TEXTURE_CUBE_MAP, face_imgs[0]);
	}
	return true;
}

function load_texture(gl, texture, img, dummy = undefined) {
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	let use_dummy = false;
	if((use_dummy = !img) && !dummy) {
		console.log("No textures provided.");
		return false;
	}
	if(use_dummy)
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, dummy);
	else {
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		config_textures(gl, gl.TEXTURE_2D, img);
	}
	return true;
}

function config_textures(gl, tex_type, tex_img) {
	if(isPowerOf2(tex_img.width) && isPowerOf2(tex_img.height)) {
		gl.generateMipmap(tex_type);
		if(tex_type == gl.TEXTURE_2D)
			gl.texParameteri(tex_type, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	} else {
		if(glstate.get_webgl_version() == 2)
			gl.texParameteri(tex_type, gl.TEXTURE_WRAP_R, gl.REPEAT);
		gl.texParameteri(tex_type, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(tex_type, gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.texParameteri(tex_type, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	}
}

function isPowerOf2(value) {
	return (value & (value - 1)) == 0;
}

function getProgramInfo(gl, shaderProg) {
	return {
		program: shaderProg,
		attribLocations: {
			vertexPosition: gl.getAttribLocation(shaderProg, 'aVtxPos')
		},
		uniformLocations: {
			projMatrix: gl.getUniformLocation(shaderProg, 'uProj'),
			mvMatrix: gl.getUniformLocation(shaderProg, 'uMV'),
			cameraPosition: gl.getUniformLocation(shaderProg, 'cameraPos'),
			focalLength: gl.getUniformLocation(shaderProg, "focalLength"),
			windowSize: gl.getUniformLocation(shaderProg, "windowSize"),
			cubemap: gl.getUniformLocation(shaderProg, "envMap"),
			film_depth: gl.getUniformLocation(shaderProg, "filmDepth"),
			time: gl.getUniformLocation(shaderProg, "time"),
			n: gl.getUniformLocation(shaderProg, "n"),
		}
	};
}

function initBuffers(gl) {
	const posBuf = gl.createBuffer();
	const indexBuf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);

	const plane = createPlane();

	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(plane.vertices), gl.STATIC_DRAW);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(plane.indices), gl.STATIC_DRAW);

	return {
		position: posBuf,
		indices: indexBuf
	};
}

function draw(gl, programInfo, bufs) {
	resize(gl);
	gl.clearColor(0, 0, 0, 1);
	gl.clearDepth(1);
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	const fov = 135. * Math.PI / 180;
	const focal = 1. / Math.tan(fov / 2);
	const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	const zNear = .1;
	const zFar = 100;
	const projMatrix = mat4.perspective(mat4.create(), fov, aspect, zNear, zFar);
	const mvMatrix = mat4.create();
	mat4.translate(mvMatrix, mvMatrix, [0, 0, -focal]);

	gl.bindBuffer(gl.ARRAY_BUFFER, bufs.position);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.indices);
	gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3,
		gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

	gl.useProgram(programInfo.program);

	setUniforms(gl, programInfo, {
		projMatrix: projMatrix,
		mvMatrix: mvMatrix,
		focalLength: focal,
		windowSize: [gl.canvas.width, gl.canvas.height],
		n: [getSliderValue('rindex'), getSliderValue('gindex'), getSliderValue('bindex')]
	});

	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function setUniforms(gl, programInfo, uniforms) {
	gl.uniformMatrix4fv(programInfo.uniformLocations.projMatrix, false,
		uniforms.projMatrix);
	gl.uniformMatrix4fv(programInfo.uniformLocations.mvMatrix, false,
		uniforms.mvMatrix);
	gl.uniform3fv(programInfo.uniformLocations.cameraPosition, getCameraPos(uniforms.mvMatrix));
	gl.uniform1f(programInfo.uniformLocations.focalLength, uniforms.focalLength);
	gl.uniform2fv(programInfo.uniformLocations.windowSize, uniforms.windowSize);
	gl.uniform1f(programInfo.uniformLocations.time, curtime.getTime());
	gl.uniform1i(programInfo.uniformLocations.cubemap, 0);
	gl.uniform1i(programInfo.uniformLocations.film_depth, 1);
	gl.uniform3fv(programInfo.uniformLocations.n, uniforms.n);
}

function getCameraPos(mvMatrix) {
	let translate = vec3.fromValues(mvMatrix[12], mvMatrix[13], mvMatrix[14]);
	vec3.negate(translate, translate);
	let rotmtx = mat3.normalFromMat4(mat3.create(), mvMatrix);
	vec3.transformMat3(translate, translate, rotmtx);
	return new Float32Array(translate);
}

var halt = false;
function animate(gl, bufs) {
	let draw_frame = (frametime) => {
		curtime.setDelta(frametime);
		while(halt);
		draw(gl, programInfo, bufs);
		window.requestAnimationFrame(draw_frame);
	};
	window.requestAnimationFrame(draw_frame);
}

function loadNewCubemap(cube_index) {
	halt = true;
	let img_path = "";
	let img_paths = [];
	switch(cube_index) {
		case 0:
			img_path = "assets/cubemap/";
			img_paths = ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"];
			break;
		case 1:
			img_path = "assets/"
			for(var i = 0; i < 6; ++i)
				img_paths.push("checkerboard.jpg");
			break;
		case 2:
			img_path = "assets/skybox/mp_goldrush/";
			img_paths = ["lf.png", "rt.png", "up.png", "dn.png", "ft.png", "bk.png"];
			break;
	}
	halt = false;
	return loadCubemap(gl, img_path, img_paths);
}

var curtime;
var shaderProg;
var programInfo;
function main() {
    	document.getElementById("bubble").checked = true;
    	document.getElementById("mountains").checked = true;
    	document.getElementById("animated").checked = true;
	setdefault('rindex');
	const gl = getGLContext();
	if(!gl) {
		console.log("Unable to initialize WebGL. Check if your browser supports it.");
		return;
	}
	if(vsSrc === undefined || bubbleFsSrc === undefined || glassFsSrc === undefined) {
		console.log("Define the shaders before using them");
		return;
	}
	loadNewFShader(bubbleFsSrc);
	const bufs = initBuffers(gl);
	loadNewCubemap(0).then(() => {
		return createAndLoadTexture(gl, 'assets/film_texture2.jpg');
	}, (err) => {
		console.log(err || "Can't load cubemap!")
	}).then(() => {
		curtime = new Time();
		animate(gl, bufs);
	}, (err) => {
		console.log(err || "Can't load texture!")
	});
}
