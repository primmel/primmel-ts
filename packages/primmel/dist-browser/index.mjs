//#region \0rolldown/runtime.js
var e = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports);
//#endregion
//#region packages/primmel/src/ser-des/tokenize.ts
function t(e) {
	let t = [], n = 1, r = 1, i = 0, a = 0, o = (t) => {
		for (let o = 0; o < t; o++) e.charAt(i) === "\n" ? (n++, r = 1) : r++, i++, a++;
	};
	for (; a < e.length;) {
		let c = e.charAt(a);
		if (c === "#" || c === "/" && a + 1 < e.length && e.charAt(a + 1) === "/") {
			for (; a < e.length && e.charAt(a) !== "\n";) o(1);
			continue;
		}
		if (s(c)) {
			o(1);
			continue;
		}
		let l = n, u = r, d = i, f = "";
		if (c === "\"") for (f += c, o(1); a < e.length;) {
			let t = e.charAt(a);
			if (t === "\\" && a + 1 < e.length) {
				f += t + e.charAt(a + 1), o(2);
				continue;
			}
			if (f += t, o(1), t === "\"") break;
		}
		else if (c === "{") {
			let t = 1;
			for (f += c, o(1); a < e.length && t > 0;) {
				let n = e.charAt(a);
				if (n === "\"") {
					for (f += n, o(1); a < e.length;) {
						let t = e.charAt(a);
						if (t === "\\" && a + 1 < e.length) {
							f += t + e.charAt(a + 1), o(2);
							continue;
						}
						if (f += t, o(1), t === "\"") break;
					}
					continue;
				}
				n === "{" && t++, n === "}" && t--, f += n, o(1);
			}
		} else for (; a < e.length && !s(e.charAt(a));) f += e.charAt(a), o(1);
		t.push({
			value: f,
			start: {
				line: l,
				col: u,
				offset: d
			},
			end: {
				line: n,
				col: r,
				offset: i
			}
		});
	}
	return t;
}
function n(e) {
	return t(e).map((e) => e.value);
}
function r(e) {
	return n(i(e));
}
function i(e) {
	return e.length >= 2 ? e.substr(1, e.length - 2) : e;
}
function a(e) {
	if (e.length < 2) return e;
	let t = e.charAt(0), n = e.charAt(e.length - 1);
	return t === "\"" && n === "\"" || t === "{" && n === "}" ? e.substr(1, e.length - 2) : e;
}
function o(e) {
	return e.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}
function s(e) {
	return /\s/.test(e);
}
//#endregion
//#region packages/primmel/src/duplicate-id.ts
function c() {
	let e = /* @__PURE__ */ new Map();
	return { check(t, n, r, i) {
		let a = e.get(t);
		a || (a = /* @__PURE__ */ new Map(), e.set(t, a));
		let o = a.get(r);
		if (o) return {
			severity: "error",
			code: "duplicate-id",
			construct: String(t),
			id: r,
			message: `Duplicate ${n} id "${r}" (first declared at line ${o.line} col ${o.col}) — earlier declaration overwritten`,
			position: { ...i }
		};
		a.set(r, i);
	} };
}
//#endregion
//#region packages/primmel/src/ser-des/parse.ts
function l(e, n, r = {}) {
	let i = t(e), a = c(), o = {
		root: "",
		metadata: null,
		approvals: {},
		roles: {},
		processes: {},
		pages: {},
		gateways: {},
		regs: {},
		references: {},
		provisions: {},
		dataclasses: {},
		events: {},
		enums: {},
		variables: {},
		notes: {},
		tables: {},
		figures: {},
		links: {},
		mapProfiles: {},
		viewProfiles: {},
		terms: {},
		forms: {},
		subforms: {},
		symbols: {},
		calculations: {},
		stateMachines: {},
		issues: []
	}, s = 0;
	for (; s < i.length;) {
		let e = i[s++], t = e.value, c = n[t];
		if (!c) {
			if (r.strict) throw Error(`Unknown keyword "${t}" at line ${e.start.line} col ${e.start.col}. Use lenient mode (default) to skip unknown keywords.`);
			continue;
		}
		let l;
		if (c.takesID) {
			if (s + 1 > i.length) throw Error(`Keyword "${t}" at line ${e.start.line} col ${e.start.col} expects an ID and payload, but only ${i.length - s + 1} token(s) remain.`);
			let n = i[s++], r = i[s++];
			if (c.field) {
				let e = a.check(c.field, t, n.value, n.start);
				e && o.issues.push(e);
			}
			l = c.parse(n.value, r.value);
		} else {
			if (s >= i.length) throw Error(`Keyword "${t}" at line ${e.start.line} col ${e.start.col} expects a payload, but no tokens remain.`);
			let n = i[s++];
			l = c.parse(n.value);
		}
		let u = l(o);
		u !== o && (u.issues = o.issues), o = u;
	}
	return o;
}
//#endregion
//#region packages/primmel/src/ser-des/resolve.ts
var u = {
	schema: "",
	author: "",
	title: "",
	edition: "",
	namespace: "",
	shortname: ""
};
function d(e, t, n) {
	let r = e[t];
	if (r == null) return;
	let i = r[n];
	if (i !== void 0) {
		if (i._relations) {
			let e = { ...i };
			return delete e._relations, e;
		}
		return i;
	}
}
function f(e, t) {
	let n = {
		meta: e.metadata ?? u,
		root: null
	};
	for (let r of Object.keys(t)) {
		let i = t[r];
		if (!i) continue;
		let a = e[r];
		if (!a) continue;
		let o = [];
		for (let [, t] of Object.entries(a)) {
			let n = i.resolve(e, t);
			n !== void 0 && (delete n._relations, o.push(n));
		}
		n[r] = o;
	}
	return e.root && (n.root = e.pages[e.root] ?? null), n;
}
//#endregion
//#region packages/primmel/src/ser-des/config/metadata.ts
var ee = function(e) {
	let t = {
		schema: "",
		author: "",
		title: "",
		edition: "",
		namespace: "",
		shortname: ""
	};
	if (e !== "") {
		let n = r(e), a = 0;
		for (; a < n.length;) {
			let e = n[a++];
			if (a < n.length) if (e === "title") t.title = i(n[a++]);
			else if (e === "schema") t.schema = i(n[a++]);
			else if (e === "edition") t.edition = i(n[a++]);
			else if (e === "author") t.author = i(n[a++]);
			else if (e === "namespace") t.namespace = i(n[a++]);
			else if (e === "shortname") t.shortname = i(n[a++]);
			else throw Error("Parsing error: metadata. Unknown keyword " + e);
			else throw Error("Parsing error: metadata. Expecting value for " + e);
		}
	}
	return (e) => (e.metadata = t, e);
}, te = function(e) {
	let t = "metadata {\n";
	return t += "  title \"" + o(e.title) + "\"\n", t += "  schema \"" + o(e.schema) + "\"\n", t += "  edition \"" + o(e.edition) + "\"\n", t += "  author \"" + o(e.author) + "\"\n", t += "  namespace \"" + o(e.namespace) + "\"\n", t += "}\n", t;
};
//#endregion
//#region packages/primmel/src/ser-des/dump.ts
function p(e, t) {
	let n = "";
	return e.root !== null && (n += "root " + e.root.id + "\n\n"), n += te(e.meta) + "\n", Object.keys(t).forEach((r) => {
		let i = e[r], a = t[r];
		for (let e of i) n += a(e);
	}), n;
}
//#endregion
//#region packages/primmel/src/ser-des/parse-block.ts
function m(e, t, n) {
	if (e === "") return;
	let i = r(e), a = 0;
	for (; a < i.length;) {
		let e = i[a++];
		if (a >= i.length) throw Error(`Parsing error: ${n.construct}. ID ${n.id}: Expecting value for ${e}`);
		t(e, () => i[a++]) || a++;
	}
}
function ne(e, t, n) {
	if (e === "") return;
	let a = r(e), o = 0;
	for (; o < a.length;) {
		let e = [];
		for (; o < a.length && a[o].charAt(0) !== "{";) e.push(a[o++]);
		if (e.length === 0) throw Error(`Parsing error: ${n.construct}. ID ${n.id}: Attribute is missing its name`);
		if (o >= a.length) throw Error(`Parsing error: ${n.construct}. ID ${n.id}: Expecting { after ${e.join(" ")}`);
		let r = a[o++];
		t(e.join(" "), i(r));
	}
}
function h(e) {
	return i(e());
}
//#endregion
//#region packages/primmel/src/ser-des/config/approval.ts
var re = function(e, t) {
	let n = {
		id: e,
		name: "",
		modality: "",
		actor: null,
		approver: null,
		records: [],
		ref: [],
		_relations: {
			actor: "",
			approver: "",
			records: [],
			ref: []
		}
	};
	return m(t, (e, t) => {
		if (e === "modality") n.modality = t();
		else if (e === "name") n.name = h(t);
		else if (e === "actor") n._relations.actor = t();
		else if (e === "approve_by") n._relations.approver = t();
		else if (e === "approval_record") n._relations.records = r(t());
		else if (e === "reference") n._relations.ref = r(t());
		else return !1;
		return !0;
	}, {
		construct: "approval",
		id: e
	}), (t) => (t.approvals[e] = n, t);
}, ie = function(e, t) {
	let { _relations: n, ...r } = t, i = {
		...r,
		records: [],
		ref: []
	};
	n.actor !== "" && (i.actor = d(e, "roles", n.actor) ?? null), n.approver !== "" && (i.approver = d(e, "roles", n.approver) ?? null);
	for (let t of n.records) {
		let n = d(e, "regs", t);
		n !== void 0 && i.records.push(n);
	}
	for (let t of n.ref) {
		let n = d(e, "references", t);
		n !== void 0 && i.ref.push(n);
	}
	return i;
}, ae = function(e) {
	let t = "approval " + e.id + " {\n";
	if (t += "  name \"" + o(e.name) + "\"\n", e.actor !== null && (t += "  actor " + e.actor.id + "\n"), t += "  modality " + e.modality + "\n", e.approver !== null && (t += "  approve_by " + e.approver.id + "\n"), e.records.length > 0) {
		t += "  approval_record {\n";
		for (let n of e.records) t += "    " + n.id + "\n";
		t += "  }\n";
	}
	if (e.ref.length > 0) {
		t += "  reference {\n";
		for (let n of e.ref) t += "    " + n.id + "\n";
		t += "  }\n";
	}
	return t += "}\n", t;
}, oe = (e, t) => {
	let n = {
		id: e,
		values: []
	};
	return m(t, (e, t) => (n.values.push(se(e, t())), !0), {
		construct: "enum",
		id: e
	}), (t) => (t.enums[e] = n, t);
}, se = (e, t) => {
	let n = {
		id: e,
		value: ""
	};
	return m(t, (e, t) => {
		if (e === "definition") n.value = h(t);
		else return !1;
		return !0;
	}, {
		construct: "enum value",
		id: e
	}), n;
}, ce = function(e, t) {
	let n = {
		id: e,
		title: "",
		data: null,
		_relations: { data: "" }
	};
	return m(t, (e, t) => {
		if (e === "title") n.title = h(t);
		else if (e === "data_class") n._relations.data = t();
		else return !1;
		return !0;
	}, {
		construct: "registry",
		id: e
	}), (t) => (t.regs[e] = n, t);
}, le = function(e, t) {
	let n = {
		id: e,
		attributes: []
	};
	return ne(t, (e, t) => {
		n.attributes.push(ue(e.trim(), t));
	}, {
		construct: "class",
		id: e
	}), (t) => (t.dataclasses[e] = n, t);
}, ue = (e, t) => {
	let n = {
		id: "",
		type: "",
		modality: "",
		cardinality: "",
		definition: "",
		ref: [],
		satisfy: [],
		_relations: { ref: [] }
	}, i = e.indexOf("[");
	return i !== -1 && (n.cardinality = e.substr(i + 1, e.length - i - 2).trim(), e = e.substr(0, i)), i = e.indexOf(":"), i !== -1 && (n.type = e.substr(i + 1, e.length - i - 1).trim(), e = e.substr(0, i)), n.id = e.trim(), m(t, (e, t) => {
		if (e === "modality") n.modality = t();
		else if (e === "definition") n.definition = h(t);
		else if (e === "reference") n._relations.ref = r(t());
		else if (e === "satisfy") n.satisfy = r(t());
		else return !1;
		return !0;
	}, {
		construct: "data attribute",
		id: n.id
	}), n;
}, de = function(e, t) {
	let n = t.attributes.map((t) => {
		let n = {
			...t,
			ref: []
		};
		for (let r of t._relations.ref) {
			let t = d(e, "references", r);
			t !== void 0 && n.ref.push(t);
		}
		return n;
	});
	return {
		id: t.id,
		attributes: n
	};
}, fe = function(e, t) {
	let { _relations: n, ...r } = t, i = {
		...r,
		data: null
	};
	if (n.data !== "") {
		let t = d(e, "dataclasses", n.data);
		t !== void 0 && (i.data = t);
	}
	return i;
}, pe = function(e) {
	let t = "class " + e.id + " {\n";
	for (let n of e.attributes) t += me(n);
	return t += "}\n", t;
}, me = (e) => {
	let t = "  " + e.id;
	if (e.type !== "" && (t += ": " + e.type), e.cardinality !== "" && (t += "[" + e.cardinality + "]"), t += " {\n", t += "    definition \"" + o(e.definition) + "\"\n", e.modality !== "" && (t += "    modality " + e.modality + "\n"), e.satisfy.length > 0) {
		t += "    satisfy {\n";
		for (let n of e.satisfy) t += "      " + n + "\n";
		t += "    }\n";
	}
	if (e.ref.length > 0) {
		t += "    reference {\n";
		for (let n of e.ref) t += "      " + n.id + "\n";
		t += "    }\n";
	}
	return t += "  }\n", t;
}, he = (e) => {
	let t = "  " + e.id + " {\n";
	return t += "    definition \"" + o(e.value) + "\"\n", t += "  }\n", t;
}, ge = function(e) {
	let t = "enum " + e.id + " {\n";
	for (let n of e.values) t += he(n);
	return t += "}\n", t;
}, _e = function(e) {
	let t = "data_registry " + e.id + " {\n";
	return t += "  title \"" + o(e.title) + "\"\n", e.data !== null && (t += "  data_class " + e.data.id + "\n"), t += "}\n", t;
}, g = function(e, t) {
	let n = {
		id: e,
		type: "",
		definition: "",
		description: ""
	};
	return m(t, (e, t) => {
		if (e === "type") n.type = t();
		else if (e === "definition") n.definition = h(t);
		else if (e === "description") n.description = h(t);
		else return !1;
		return !0;
	}, {
		construct: "variable",
		id: e
	}), (t) => (t.variables[e] = n, t);
}, _ = function(e) {
	let t = "variable " + e.id + " {\n";
	return e.type !== "" && (t += "  type " + e.type + "\n"), e.definition !== "" && (t += "  definition \"" + o(e.definition) + "\"\n"), e.description !== "" && (t += "  description \"" + o(e.description) + "\"\n"), t += "}\n", t;
}, v = function(e, t) {
	let n = {
		id: e,
		eventType: "end"
	};
	if (t !== "" && r(t).length > 0) throw Error(`Parsing error: end_event. ID ${e}: Expecting empty body`);
	return (t) => (t.events[e] = n, t);
}, y = function(e, t) {
	let n = {
		id: e,
		eventType: "signalcatch",
		signal: ""
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) t === "catch" ? n.signal = i(a[o++]) : o++;
			else throw Error(`Parsing error: Signal Catch Event. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.events[e] = n, t);
}, b = function(e, t) {
	let n = {
		id: e,
		eventType: "start"
	};
	if (t !== "" && r(t).length > 0) throw Error(`Parsing error: end_event. ID ${e}: Expecting empty body`);
	return (t) => (t.events[e] = n, t);
}, x = function(e, t) {
	let n = {
		id: e,
		eventType: "timer",
		type: "",
		para: ""
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) t === "type" ? n.type = a[o++] : t === "para" ? n.para = i(a[o++]) : o++;
			else throw Error(`Parsing error: Timer Event. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.events[e] = n, t);
}, S = function(e) {
	return e.eventType === "start" ? T(e) : e.eventType === "end" ? C(e) : e.eventType === "signalcatch" ? w(e) : e.eventType === "timer" ? E(e) : "";
};
function C(e) {
	return "end_event " + e.id + " {\n}\n";
}
function w(e) {
	let t = "signal_catch_event " + e.id + " {\n";
	return e.signal !== "" && (t += "  catch \"" + o(e.signal) + "\"\n"), t += "}\n", t;
}
function T(e) {
	return "start_event " + e.id + " {\n}\n";
}
function E(e) {
	let t = "timer_event " + e.id + " {\n";
	return e.type !== "" && (t += "  type " + e.type + "\n"), e.para !== "" && (t += "  para \"" + o(e.para) + "\"\n"), t += "}\n", t;
}
//#endregion
//#region packages/primmel/src/ser-des/config/gateway.ts
var D = function(e, t) {
	let n = {
		id: e,
		gatewayType: "exclusive_gateway",
		label: ""
	};
	return m(t, (e, t) => {
		if (e === "label") n.label = h(t);
		else return !1;
		return !0;
	}, {
		construct: "Exclusive gateway",
		id: e
	}), (t) => (t.gateways[e] = n, t);
}, O = function(e) {
	return e.gatewayType === "exclusive_gateway" ? k(e) : "";
};
function k(e) {
	let t = "exclusive_gateway " + e.id + " {\n";
	return e.label !== "" && (t += "  label \"" + o(e.label) + "\"\n"), t += "}\n", t;
}
//#endregion
//#region packages/primmel/src/ser-des/config/process.ts
var A = function(e, t) {
	let n = {
		id: e,
		name: "",
		modality: "",
		actor: null,
		output: [],
		input: [],
		provision: [],
		page: null,
		measure: [],
		_relations: {
			actor: "",
			output: [],
			input: [],
			provision: [],
			page: ""
		}
	};
	return m(t, (e, t) => {
		if (e === "modality") n.modality = t();
		else if (e === "name") n.name = h(t);
		else if (e === "actor") n._relations.actor = t();
		else if (e === "subprocess") n._relations.page = t();
		else if (e === "validate_provision") n._relations.provision = r(t());
		else if (e === "validate_measurement") n.measure = r(t()).map((e) => i(e));
		else if (e === "output") n._relations.output = r(t());
		else if (e === "reference_data_registry") n._relations.input = r(t());
		else return !1;
		return !0;
	}, {
		construct: "process",
		id: e
	}), (t) => (t.processes[e] = n, t);
}, j = function(e, t) {
	let { _relations: n, ...r } = t, i = {
		...r,
		output: [],
		input: [],
		provision: [],
		actor: null,
		page: null
	};
	for (let t of n.output) {
		let n = d(e, "regs", t);
		n !== void 0 && i.output.push(n);
	}
	for (let t of n.input) {
		let n = d(e, "regs", t);
		n !== void 0 && i.input.push(n);
	}
	for (let t of n.provision) {
		let n = d(e, "provisions", t);
		n !== void 0 && i.provision.push(n);
	}
	return n.actor !== "" && (i.actor = d(e, "roles", n.actor) ?? null), n.page !== "" && (i.page = d(e, "pages", n.page) ?? null), i;
}, M = function(e) {
	let t = "process " + e.id + " {\n";
	if (t += "  name \"" + o(e.name) + "\"\n", e.actor !== null && (t += "  actor " + e.actor.id + "\n"), e.modality !== "" && (t += "  modality " + e.modality + "\n"), e.input.length > 0) {
		t += "  reference_data_registry {\n";
		for (let n of e.input) t += "    " + n.id + "\n";
		t += "  }\n";
	}
	if (e.provision.length > 0) {
		t += "  validate_provision {\n";
		for (let n of e.provision) t += "    " + n.id + "\n";
		t += "  }\n";
	}
	if (e.measure.length > 0) {
		t += "  validate_measurement {\n";
		for (let n of e.measure) t += "    \"" + n + "\"\n";
		t += "  }\n";
	}
	if (e.output.length > 0) {
		t += "  output {\n";
		for (let n of e.output) t += "    " + n.id + "\n";
		t += "  }\n";
	}
	return e.page !== null && (t += "  subprocess " + e.page.id + "\n"), t += "}\n", t;
}, N = function(e, t) {
	let n = {
		subject: /* @__PURE__ */ new Map(),
		id: e,
		modality: "",
		condition: "",
		ref: [],
		_relations: { ref: [] }
	};
	return m(t, (e, t) => (e === "modality" ? n.modality = t() : e === "condition" ? n.condition = h(t) : e === "reference" ? n._relations.ref = r(t()) : n.subject.set(e, t()), !0), {
		construct: "provision",
		id: e
	}), (t) => (t.provisions[e] = n, t);
}, P = function(e, t) {
	let n = [];
	for (let r of t._relations.ref) {
		let t = d(e, "references", r);
		t !== void 0 && n.push(t);
	}
	return {
		...t,
		ref: n
	};
}, F = function(e) {
	let t = "provision " + e.id + " {\n";
	if (e.subject.forEach((e, n) => {
		t += "  " + n + " " + e + "\n";
	}), t += "  condition \"" + o(e.condition) + "\"\n", e.modality !== "" && (t += "  modality " + e.modality + "\n"), e.ref.length > 0) {
		t += "  reference {\n";
		for (let n of e.ref) t += "    " + n.id + "\n";
		t += "  }\n";
	}
	return t += "}\n", t;
}, I = (e, t) => {
	let n = {
		id: e,
		document: "",
		clause: ""
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) t === "document" ? n.document = i(a[o++]) : t === "clause" ? n.clause = i(a[o++]) : o++;
			else throw Error(`Parsing error: reference. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.references[e] = n, t);
}, ve = function(e) {
	let t = "reference " + e.id + " {\n";
	return t += "  document \"" + o(e.document) + "\"\n", t += "  clause \"" + o(e.clause) + "\"\n", t += "}\n", t;
}, ye = (e, t) => {
	let n = {
		id: e,
		name: ""
	};
	return m(t, (e, t) => {
		if (e === "name") n.name = h(t);
		else return !1;
		return !0;
	}, {
		construct: "role",
		id: e
	}), (t) => (t.roles[e] = n, t);
}, be = function(e) {
	let t = "role " + e.id + " {\n";
	return t += "  name \"" + o(e.name) + "\"\n", t += "}\n", t;
}, xe = function(e, t) {
	let n = {
		id: e,
		childs: [],
		edges: [],
		data: [],
		_relations: {
			childs: [],
			edges: [],
			data: []
		},
		_components: {}
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) t === "elements" ? n = Se(i(a[o++]))(n) : t === "process_flow" ? n = we(i(a[o++]))(n) : t === "data" ? n = Ce(i(a[o++]))(n) : o++;
			else throw Error(`Parsing error: subprocess. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.pages[e] = n, t);
}, Se = function(e) {
	let t = r(e), n = {}, i = 0;
	for (; i < t.length;) {
		let e = t[i++];
		if (i < t.length) {
			let r = e.trim();
			n[r] = L(r, t[i++]);
		} else throw Error(`Parsing error: elements in subprocess. Expecting value for ${e}`);
	}
	return (e) => ({
		...e,
		_components: {
			...e._components,
			...n
		},
		_relations: {
			...e._relations,
			childs: Object.values(n)
		}
	});
}, Ce = function(e) {
	let t = r(e), n = {}, i = 0;
	for (; i < t.length;) {
		let e = t[i++];
		if (i < t.length) {
			let r = e.trim();
			n[r] = L(r, t[i++]);
		} else throw Error(`Parsing error: data in subprocess. Expecting value for ${e}`);
	}
	return (e) => ({
		...e,
		_components: {
			...e._components,
			...n
		},
		_relations: {
			...e._relations,
			data: Object.values(n)
		}
	});
}, we = function(e) {
	let t = r(e), n = {}, i = 0;
	for (; i < t.length;) {
		let e = t[i++].trim();
		if (i < t.length) n[e] = Te(e.trim(), t[i++]);
		else throw Error(`Parsing error: edges in subprocess. Expecting value for ${e}`);
	}
	return (e) => ({
		...e,
		_relations: {
			...e._relations,
			edges: Object.values(n)
		}
	});
};
function L(e, t) {
	let n = {
		name: e,
		element: null,
		x: 0,
		y: 0,
		_relations: { element: e }
	}, i = r(t), a = 0;
	for (; a < i.length;) {
		let t = i[a++];
		if (a < i.length) t === "x" ? n.x = parseFloat(i[a++]) : t === "y" ? n.y = parseFloat(i[a++]) : a++;
		else throw Error(`Parsing error: subprocess component. Element ${e}: Expecting value for ${t}`);
	}
	return n;
}
function Te(e, t) {
	let n = {
		id: e,
		from: null,
		to: null,
		description: "",
		condition: "",
		_relations: {
			from: "",
			to: ""
		}
	}, a = r(t), o = 0;
	for (; o < a.length;) {
		let t = a[o++];
		if (o < a.length) t === "from" ? n._relations.from = a[o++] : t === "description" ? n.description = i(a[o++]) : t === "condition" ? n.condition = i(a[o++]) : t === "to" ? n._relations.to = a[o++] : o++;
		else throw Error(`Parsing error: process_flow. ID ${e}: Expecting value for ${t}`);
	}
	return n;
}
var Ee = function(e, t) {
	let n = t._relations ?? {
		childs: [],
		edges: [],
		data: []
	}, r = t._components ?? {}, i = /* @__PURE__ */ new Map();
	for (let e of Object.values(r)) e._relations?.element && i.set(e._relations.element, e);
	let a = (t) => ({
		name: t.name,
		x: t.x,
		y: t.y,
		element: De(e, t._relations.element)
	});
	return {
		id: t.id,
		childs: n.childs.map(a),
		edges: n.edges.map((e) => {
			let t = e._relations.from ? i.get(e._relations.from) : void 0, n = e._relations.to ? i.get(e._relations.to) : void 0;
			return {
				id: e.id,
				description: e.description,
				condition: e.condition,
				from: t ? a(t) : null,
				to: n ? a(n) : null
			};
		}),
		data: n.data.map(a)
	};
};
function De(e, t) {
	return d(e, "processes", t) ?? d(e, "approvals", t) ?? d(e, "events", t) ?? d(e, "gateways", t) ?? null;
}
var Oe = function(e) {
	let t = "canvas " + e.id + " {\n";
	return t += "  elements {\n", e.childs.forEach((e) => {
		t += R(e);
	}), t += "  }\n", t += "  process_flow {\n", e.edges.forEach((e) => {
		t += ke(e);
	}), t += "  }\n", t += "  data {\n", e.data.forEach((e) => {
		t += R(e);
	}), t += "  }\n", t += "}\n", t;
};
function R(e) {
	let t = "    " + (e.element?.id ?? e.name) + " {\n";
	return t += "      x " + e.x + "\n", t += "      y " + e.y + "\n", t += "    }\n", t;
}
function ke(e) {
	let t = "    " + e.id + " {\n";
	return e.from !== null && e.from.element !== null && (t += "      from " + e.from.element.id + "\n"), e.to !== null && e.to.element !== null && (t += "      to " + e.to.element.id + "\n"), e.description !== "" && (t += "      description \"" + o(e.description) + "\"\n"), e.condition !== "" && (t += "      condition \"" + o(e.condition) + "\"\n"), t += "    }\n", t;
}
//#endregion
//#region packages/primmel/src/ser-des/config/note.ts
var z = [
	"NOTE",
	"CAUTION",
	"WARNING"
], Ae = function(e, t) {
	let n = {
		id: e,
		type: "NOTE",
		message: "",
		ref: [],
		_relations: { ref: [] }
	};
	return m(t, (t, i) => {
		if (t === "type") {
			let t = i();
			if (!z.includes(t)) throw Error(`Parsing error: note. ID ${e}: Unknown type ${t} (valid: ${z.join(", ")})`);
			n.type = t;
		} else if (t === "message") n.message = h(i);
		else if (t === "reference") n._relations.ref = r(i());
		else return !1;
		return !0;
	}, {
		construct: "note",
		id: e
	}), (t) => (t.notes[e] = n, t);
}, je = function(e, t) {
	let n = [];
	for (let r of t._relations.ref) {
		let t = d(e, "references", r);
		t !== void 0 && n.push(t);
	}
	return {
		...t,
		ref: n
	};
}, Me = function(e) {
	let t = "note " + e.id + " {\n";
	if (t += "  type " + e.type + "\n", t += "  message \"" + o(e.message) + "\"\n", e.ref.length > 0) {
		t += "  reference {\n";
		for (let n of e.ref) t += "    " + n.id + "\n";
		t += "  }\n";
	}
	return t += "}\n", t;
}, Ne = function(e, t) {
	let n = {
		id: e,
		title: "",
		columns: "",
		display: "",
		data: [],
		domain: null
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) t === "title" ? n.title = i(a[o++]) : t === "columns" ? n.columns = i(a[o++]) : t === "display" ? n.display = i(a[o++]) : t === "domain" ? n.domain = i(a[o++]) : t === "data" ? n.data = Pe(i(a[o++])) : o++;
			else throw Error(`Parsing error: table. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.tables[e] = n, t);
};
function Pe(e) {
	return e.split(/\n+/).map((e) => e.trim()).filter((e) => e.length > 0).map((e) => {
		let t = [], n = /"([^"]*)"|(\S+)/g, r;
		for (; (r = n.exec(e)) !== null;) t.push(r[1] ?? r[2] ?? "");
		return t;
	});
}
var Fe = function(e) {
	let t = "table " + e.id + " {\n";
	if (t += "  title \"" + e.title + "\"\n", t += "  columns \"" + e.columns + "\"\n", e.display && (t += "  display \"" + e.display + "\"\n"), e.domain && (t += "  domain { }\n"), e.data.length > 0) {
		t += "  data {\n";
		for (let n of e.data) {
			let e = n.map((e) => `"${e}"`).join(" ");
			t += "    " + e + "\n";
		}
		t += "  }\n";
	}
	return t += "}\n", t;
}, Ie = function(e, t) {
	let n = {
		id: e,
		title: "",
		src: ""
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) t === "title" ? n.title = i(a[o++]) : t === "src" ? n.src = i(a[o++]) : o++;
			else throw Error(`Parsing error: figure. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.figures[e] = n, t);
}, Le = function(e) {
	let t = "figure " + e.id + " {\n";
	return t += "  title \"" + o(e.title) + "\"\n", t += "  src \"" + o(e.src) + "\"\n", t += "}\n", t;
}, B = ["REPO", "URL"], Re = function(e, t) {
	let n = {
		id: e,
		kind: "URL",
		target: "",
		namespace: ""
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) if (t === "type" || t === "kind") {
				let t = a[o++];
				if (!B.includes(t)) throw Error(`Parsing error: link. ID ${e}: Unknown kind ${t} (valid: ${B.join(", ")})`);
				n.kind = t;
			} else t === "target" || t === "path" || t === "url" ? n.target = i(a[o++]) : t === "namespace" || t === "ns" ? n.namespace = i(a[o++]) : o++;
			else throw Error(`Parsing error: link. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.links[e] = n, t);
}, ze = function(e) {
	let t = "link " + e.id + " {\n";
	return t += "  type " + e.kind + "\n", t += "  target \"" + o(e.target) + "\"\n", e.namespace && (t += "  namespace \"" + o(e.namespace) + "\"\n"), t += "}\n", t;
}, Be = function(e, t) {
	let n = {
		namespace: e,
		description: "",
		mappings: {}
	};
	return m(t, (e, t) => {
		if (e === "description") n.description = h(t);
		else if (e === "mapping") {
			let e = h(t);
			for (let t of e.split(/\n+/).map((e) => e.trim()).filter((e) => e)) {
				let e = t.match(/^(\S+)\s*->\s*(\S+)$/);
				e && (n.mappings[e[1]] = e[2]);
			}
		} else return !1;
		return !0;
	}, {
		construct: "map_profile",
		id: e
	}), (t) => (t.mapProfiles[e] = n, t);
}, Ve = function(e) {
	let t = "map_profile " + e.namespace + " {\n";
	e.description && (t += "  description \"" + e.description + "\"\n");
	let n = Object.keys(e.mappings);
	if (n.length > 0) {
		t += "  mapping {\n";
		for (let r of n) t += "    " + r + " -> " + e.mappings[r] + "\n";
		t += "  }\n";
	}
	return t += "}\n", t;
}, He = function(e, t) {
	let n = {
		id: e,
		description: "",
		roles: [],
		visibleElements: []
	};
	return m(t, (e, t) => {
		if (e === "description") n.description = h(t);
		else if (e === "roles") n.roles = r(t());
		else if (e === "visible") n.visibleElements = r(t());
		else return !1;
		return !0;
	}, {
		construct: "view_profile",
		id: e
	}), (t) => (t.viewProfiles[e] = n, t);
}, Ue = function(e) {
	let t = "view_profile " + e.id + " {\n";
	return e.description && (t += "  description \"" + e.description + "\"\n"), e.roles.length > 0 && (t += "  roles " + e.roles.join(" ") + "\n"), e.visibleElements.length > 0 && (t += "  visible " + e.visibleElements.join(" ") + "\n"), t += "}\n", t;
};
//#endregion
//#region packages/primmel/src/ser-des/config/field-parser.ts
function V(e, t) {
	let n = {
		name: e,
		type: "string",
		label: "",
		definition: "",
		unit: "",
		required: !1,
		measurementMethod: "",
		calculationId: null,
		calculationBindings: [],
		derivation: "",
		evaluation: null,
		values: [],
		defaultValue: "",
		hasDefault: !1,
		referenceIds: [],
		fields: [],
		itemsType: "",
		subformRef: null
	};
	if (!t || !t.trim()) return n;
	let o = r(t), s = 0;
	for (; s < o.length;) {
		let e = o[s++];
		if (s >= o.length) break;
		e === "label" ? n.label = i(o[s++]) : e === "definition" ? n.definition = i(o[s++]) : e === "unit" ? n.unit = i(o[s++]) : e === "required" ? n.required = i(o[s++]) === "true" : e === "measurement_method" ? n.measurementMethod = i(o[s++]) : e === "calculation" ? n.calculationId = a(o[s++]) : e === "calculation_bindings" ? i(o[s++]) : e === "derivation" ? n.derivation = i(o[s++]) : e === "evaluation" ? i(o[s++]) : e === "values" ? n.values = r(o[s++]) : e === "default" ? (n.defaultValue = i(o[s++]), n.hasDefault = !0) : e === "min_items" || e === "max_items" || e === "items" || e === "fields" ? i(o[s++]) : e === "reference" ? n.referenceIds = r(o[s++]) : i(o[s++]);
	}
	return n;
}
//#endregion
//#region packages/primmel/src/ser-des/config/form.ts
var We = function(e, t) {
	let n = {
		id: e,
		name: "",
		description: "",
		dataClassId: "",
		headerFormId: "",
		conformanceProcessId: "",
		applicability: [],
		fields: [],
		passFail: null,
		referenceIds: [],
		ref: []
	};
	if (t !== "") {
		let o = r(t), s = 0;
		for (; s < o.length;) {
			let t = o[s++];
			if (s < o.length) if (t === "name") n.name = i(o[s++]);
			else if (t === "description") n.description = i(o[s++]);
			else if (t === "data_class") n.dataClassId = a(o[s++]);
			else if (t === "header") n.headerFormId = a(o[s++]);
			else if (t === "conformance_process") n.conformanceProcessId = a(o[s++]);
			else if (t === "applicability") n.applicability = H(i(o[s++]));
			else if (t === "field") {
				let e = o[s++];
				if (s < o.length) {
					let t = i(o[s++]);
					n.fields.push(V(e, t));
				}
			} else if (t === "subform_ref") {
				let e = o[s++], t = s < o.length ? i(o[s++]) : "";
				n.fields.push(Ke(e, t));
			} else t === "pass_fail" ? n.passFail = Ge(i(o[s++])) : t === "reference" ? n.referenceIds = r(o[s++]) : s++;
			else throw Error(`Parsing error: form. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.forms[e] = n, t);
};
function H(e) {
	let t = [], n = r(e), a = 0;
	for (; a < n.length;) {
		let e = n[a++];
		if (a >= n.length) break;
		if (n[a] === ":" && a++, a < n.length) {
			let r = i(n[a++]).trim();
			if (r.startsWith("[")) {
				let n = r.slice(1, -1).split(/[,\s]+/).filter((e) => e.length > 0);
				t.push({
					dimension: e,
					values: n,
					mapping: null
				});
			} else if (r.startsWith("{")) {
				let n = r.slice(1, -1), i = {};
				for (let e of n.split(/[,\n]+/).map((e) => e.trim()).filter((e) => e)) {
					let t = e.match(/^(\w+)\s*:\s*(.+)$/);
					t && (i[t[1]] = t[2].trim());
				}
				t.push({
					dimension: e,
					values: [],
					mapping: i
				});
			} else t.push({
				dimension: e,
				values: [r],
				mapping: null
			});
		}
	}
	return t;
}
function Ge(e) {
	let t = {
		criteria: "",
		passIf: ""
	}, n = r(e), a = 0;
	for (; a < n.length;) {
		let e = n[a++];
		a < n.length && (e === "criteria" ? t.criteria = i(n[a++]) : e === "pass_if" ? t.passIf = i(n[a++]) : i(n[a++]));
	}
	return t;
}
function Ke(e, t) {
	return {
		name: "",
		type: "array",
		label: "",
		definition: "",
		unit: "",
		required: !1,
		measurementMethod: "",
		calculationId: null,
		calculationBindings: [],
		derivation: "",
		evaluation: null,
		values: [],
		defaultValue: "",
		hasDefault: !1,
		referenceIds: [],
		fields: [],
		itemsType: "",
		subformRef: qe(e, t)
	};
}
function qe(e, t) {
	let n = {
		subformId: e,
		parameters: {},
		applicability: []
	};
	if (t && t.trim()) {
		let e = r(t), a = 0;
		for (; a < e.length;) {
			let t = e[a++];
			if (a < e.length) if (t === "parameters") {
				let t = r(i(e[a++])), o = 0;
				for (; o < t.length;) {
					let e = t[o++];
					o < t.length && (t[o] === ":" && o++, o < t.length && (n.parameters[e] = i(t[o++])));
				}
			} else t === "applicability" ? n.applicability = H(i(e[a++])) : i(e[a++]);
		}
	}
	return n;
}
var Je = function(e) {
	let t = "form " + e.id + " {\n";
	if (t += "  name \"" + o(e.name) + "\"\n", e.description && (t += "  description \"" + o(e.description) + "\"\n"), e.dataClassId && (t += "  data_class " + e.dataClassId + "\n"), e.headerFormId && (t += "  header " + e.headerFormId + "\n"), e.conformanceProcessId && (t += "  conformance_process " + e.conformanceProcessId + "\n"), e.applicability.length > 0) {
		t += "  applicability {\n";
		for (let n of e.applicability) if (n.mapping) {
			t += "    " + n.dimension + ": { ";
			for (let [e, r] of Object.entries(n.mapping)) t += e + ": " + r + " ";
			t += "}\n";
		} else t += "    " + n.dimension + ": [" + n.values.join(", ") + "]\n";
		t += "  }\n";
	}
	for (let n of e.fields) if (n.subformRef) {
		let e = n.subformRef;
		t += "  subform_ref " + e.subformId + " { ";
		let r = Object.keys(e.parameters);
		if (r.length > 0) {
			t += "parameters { ";
			for (let n of r) t += n + ": " + e.parameters[n] + " ";
			t += "} ";
		}
		t += "}\n";
	} else t += "  field " + n.name + " { ", n.label && (t += "label \"" + o(n.label) + "\" "), n.unit && (t += "unit \"" + o(n.unit) + "\" "), n.required && (t += "required true "), t += "}\n";
	return e.passFail && (t += "  pass_fail { criteria \"" + o(e.passFail.criteria) + "\" pass_if \"" + o(e.passFail.passIf) + "\" }\n"), t += "}\n", t;
}, Ye = function(e, t) {
	let n = {
		id: e,
		description: "",
		shapeType: "object",
		parameters: [],
		fields: []
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) if (t === "description") n.description = i(a[o++]);
			else if (t === "type") {
				let t = a[o++];
				if (t === "object" || t === "array") n.shapeType = t;
				else throw Error(`Parsing error: subform. ID ${e}: type must be object or array (got ${t})`);
			} else if (t === "parameters") n.parameters = Xe(i(a[o++]));
			else if (t === "field") {
				let e = a[o++];
				if (o < a.length) {
					let t = V(e, i(a[o++]));
					n.fields.push(t);
				}
			} else o++;
			else throw Error(`Parsing error: subform. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.subforms[e] = n, t);
};
function Xe(e) {
	let t = [], n = r(e), a = 0;
	for (; a < n.length;) {
		let e = n[a++];
		if (a >= n.length) break;
		n[a] === ":" && a++;
		let o = a < n.length ? n[a++] : "integer", s = "", c = !1, l = "", u = null;
		if (a < n.length && n[a].startsWith("{")) {
			let e = r(i(n[a++])), t = 0;
			for (; t < e.length;) {
				let n = e[t++];
				if (t < e.length) if (n === "description") s = i(e[t++]);
				else if (n === "default") l = i(e[t++]), c = !0;
				else if (n === "mapping") {
					let n = i(e[t++]);
					u = {};
					let a = r(n), o = 0;
					for (; o < a.length;) {
						let e = a[o++];
						o < a.length && (a[o] === ":" && o++, o < a.length && (u[e] = i(a[o++])));
					}
				} else t++;
			}
		}
		t.push({
			name: e,
			type: o,
			description: s,
			hasDefault: c,
			defaultValue: l,
			mapping: u
		});
	}
	return t;
}
var Ze = function(e) {
	let t = "subform " + e.id + " {\n";
	if (t += "  type " + e.shapeType + "\n", e.description && (t += "  description \"" + o(e.description) + "\"\n"), e.parameters.length > 0) {
		t += "  parameters {\n";
		for (let n of e.parameters) {
			let e = "    " + n.name + " : " + n.type + " { ";
			if (n.description && (e += "description \"" + o(n.description) + "\" "), n.hasDefault && (e += "default " + n.defaultValue + " "), n.mapping) {
				e += "mapping { ";
				for (let [t, r] of Object.entries(n.mapping)) e += t + ": " + r + " ";
				e += "} ";
			}
			e += "}\n", t += e;
		}
		t += "  }\n";
	}
	for (let n of e.fields) t += "  field " + n.name + " { ", n.label && (t += "label \"" + o(n.label) + "\" "), n.unit && (t += "unit \"" + o(n.unit) + "\" "), n.required && (t += "required true "), t += "}\n";
	return t += "}\n", t;
}, U = [
	"number",
	"integer",
	"string",
	"boolean",
	"enum"
], Qe = function(e, t) {
	let n = {
		id: e,
		name: "",
		definition: "",
		type: "number",
		unit: "1",
		latex: "",
		values: [],
		ref: [],
		_relations: { ref: [] }
	};
	return m(t, (t, i) => {
		if (t === "name") n.name = h(i);
		else if (t === "definition") n.definition = h(i);
		else if (t === "type") {
			let t = i();
			if (!U.includes(t)) throw Error(`Parsing error: symbol. ID ${e}: Unknown type ${t} (valid: ${U.join(", ")})`);
			n.type = t;
		} else if (t === "unit") n.unit = h(i);
		else if (t === "latex") n.latex = h(i);
		else if (t === "values") n.values = r(i());
		else if (t === "reference") n._relations.ref = r(i());
		else return !1;
		return !0;
	}, {
		construct: "symbol",
		id: e
	}), (t) => (t.symbols[e] = n, t);
}, $e = function(e, t) {
	let n = [];
	for (let r of t._relations.ref) {
		let t = d(e, "references", r);
		t !== void 0 && n.push(t);
	}
	return {
		...t,
		ref: n
	};
}, et = function(e) {
	let t = "symbol " + e.id + " {\n";
	if (t += "  name \"" + o(e.name) + "\"\n", e.definition && (t += "  definition \"" + o(e.definition) + "\"\n"), t += "  type " + e.type + "\n", e.unit && e.unit !== "1" && (t += "  unit \"" + o(e.unit) + "\"\n"), e.latex && (t += "  latex \"" + o(e.latex) + "\"\n"), e.values.length > 0 && (t += "  values " + e.values.join(" ") + "\n"), e.ref.length > 0) {
		t += "  reference {\n";
		for (let n of e.ref) t += "    " + n.id + "\n";
		t += "  }\n";
	}
	return t += "}\n", t;
}, tt = function(e, t) {
	let n = {
		id: e,
		name: "",
		description: "",
		inputs: [],
		output: {
			type: "number",
			unit: "1"
		},
		expression: "",
		ref: [],
		_relations: { ref: [] }
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) t === "name" ? n.name = i(a[o++]) : t === "description" ? n.description = i(a[o++]) : t === "expression" ? n.expression = i(a[o++]) : t === "reference" ? n._relations.ref = r(a[o++]) : t === "inputs" ? n.inputs = nt(i(a[o++])) : t === "output" ? n.output = rt(i(a[o++])) : o++;
			else throw Error(`Parsing error: calculation. ID ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.calculations[e] = n, t);
};
function nt(e) {
	let t = [], n = r(e), a = 0;
	for (; a < n.length;) {
		let e = n[a++];
		if (a >= n.length) break;
		n[a] === ":" && a++;
		let o = a < n.length ? n[a++] : "number", s = "1", c = "", l = "", u = !1;
		if (a < n.length && n[a].startsWith("{")) {
			let e = r(i(n[a++])), t = 0;
			for (; t < e.length;) {
				let n = e[t++];
				t < e.length && (n === "unit" ? s = i(e[t++]) : n === "description" ? c = i(e[t++]) : n === "default" ? (l = i(e[t++]), u = !0) : t++);
			}
		}
		t.push({
			name: e,
			type: o,
			unit: s,
			description: c,
			defaultValue: l,
			hasDefault: u
		});
	}
	return t;
}
function rt(e) {
	let t = r(e), n = 0, a = "number", o = "1";
	if (t[n] === ":" && n++, n < t.length && (a = t[n++]), n < t.length && t[n].startsWith("{")) {
		let e = r(i(t[n++])), a = 0;
		for (; a < e.length;) {
			let t = e[a++];
			a < e.length && (t === "unit" ? o = i(e[a++]) : a++);
		}
	}
	return {
		type: a,
		unit: o
	};
}
var it = function(e, t) {
	let n = [];
	for (let r of t._relations.ref) {
		let t = d(e, "references", r);
		t !== void 0 && n.push(t);
	}
	return {
		...t,
		ref: n
	};
}, at = function(e) {
	let t = "calculation " + e.id + " {\n";
	if (t += "  name \"" + o(e.name) + "\"\n", e.description && (t += "  description \"" + o(e.description) + "\"\n"), e.inputs.length > 0) {
		t += "  inputs {\n";
		for (let n of e.inputs) {
			let e = "    " + n.name + " : " + n.type + " { ";
			e += "unit \"" + o(n.unit) + "\"", n.description && (e += " description \"" + o(n.description) + "\""), n.hasDefault && (e += " default " + n.defaultValue), e += " }\n", t += e;
		}
		t += "  }\n";
	}
	if (t += "  output : " + e.output.type + " { unit \"" + o(e.output.unit) + "\" }\n", t += "  expression \"" + o(e.expression) + "\"\n", e.ref.length > 0) {
		t += "  reference {\n";
		for (let n of e.ref) t += "    " + n.id + "\n";
		t += "  }\n";
	}
	return t += "}\n", t;
}, ot = function(e, t) {
	let n = {
		entityName: e,
		initialState: "",
		states: [],
		transitions: [],
		referenceIds: []
	};
	if (t !== "") {
		let a = r(t), o = 0;
		for (; o < a.length;) {
			let t = a[o++];
			if (o < a.length) if (t === "initial") n.initialState = a[o++];
			else if (t === "states") {
				let e = i(a[o++]);
				for (let t of e.split(/\s+/).filter((e) => e.length > 0)) n.states.push({ name: t });
			} else if (t === "transition") {
				let e = a[o++];
				o < a.length && (a[o] === "->" || a[o] === "→") && o++;
				let t = o < a.length ? a[o++] : "", s = "";
				o < a.length && a[o] === "action" && (o++, o < a.length && (s = a[o++]));
				let c = "", l = [], u = [];
				if (o < a.length && a[o].startsWith("{")) {
					let e = r(i(a[o++])), t = 0;
					for (; t < e.length;) {
						let n = e[t++];
						if (t < e.length) if (n === "guard") c = i(e[t++]);
						else if (n === "cascade") {
							let n = e[t++];
							if (t < e.length) {
								let r = i(e[t++]);
								l.push(st(n, r));
							}
						} else n === "reference" ? u.push(...r(e[t++])) : i(e[t++]);
					}
				}
				let d = {
					from: e,
					to: t,
					actionName: s,
					guard: c,
					cascades: l,
					referenceIds: u
				};
				n.transitions.push(d);
			} else t === "reference" ? n.referenceIds.push(...r(a[o++])) : o++;
			else throw Error(`Parsing error: state_machine. Entity ${e}: Expecting value for ${t}`);
		}
	}
	return (t) => (t.stateMachines[e] = n, t);
};
function st(e, t) {
	let n = {
		targetEntity: e,
		where: "",
		set: []
	}, a = r(t), o = 0;
	for (; o < a.length;) {
		let e = a[o++];
		if (o < a.length) if (e === "where") n.where = i(a[o++]);
		else if (e === "set") {
			let e = r(i(a[o++])), t = 0;
			for (; t < e.length;) {
				let r = e[t++];
				if (t < e.length && (e[t] === ":" && t++, t < e.length)) {
					let a = {
						field: r,
						value: i(e[t++])
					};
					n.set.push(a);
				}
			}
		} else i(a[o++]);
	}
	return n;
}
var ct = function(e) {
	let t = "state_machine " + e.entityName + " {\n";
	if (t += "  initial " + e.initialState + "\n", e.states.length > 0) {
		t += "  states {\n";
		for (let n of e.states) t += "    " + n.name + "\n";
		t += "  }\n";
	}
	for (let n of e.transitions) {
		t += "  transition " + n.from + " -> " + n.to, n.actionName && (t += " action " + n.actionName), t += " {\n", n.guard && (t += "    guard \"" + o(n.guard) + "\"\n");
		for (let e of n.cascades) {
			if (t += "    cascade " + e.targetEntity + " {\n", e.where && (t += "      where \"" + o(e.where) + "\"\n"), e.set.length > 0) {
				t += "      set {\n";
				for (let n of e.set) t += "        " + n.field + ": \"" + o(n.value) + "\"\n";
				t += "      }\n";
			}
			t += "    }\n";
		}
		t += "  }\n";
	}
	return t += "}\n", t;
}, lt = function(e, t) {
	let n = {
		id: e,
		label: "",
		definition: "",
		symbolId: "",
		referenceIds: [],
		ref: []
	};
	return m(t, (e, t) => {
		if (e === "label") n.label = h(t);
		else if (e === "definition") n.definition = h(t);
		else if (e === "symbol") n.symbolId = a(t());
		else if (e === "reference") n.referenceIds = r(t());
		else return !1;
		return !0;
	}, {
		construct: "term",
		id: e
	}), (t) => (t.terms[e] = n, t);
}, ut = function(e) {
	let t = "term " + e.id + " {\n";
	if (e.label && (t += "  label \"" + o(e.label) + "\"\n"), e.definition && (t += "  definition \"" + o(e.definition) + "\"\n"), e.symbolId && (t += "  symbol " + e.symbolId + "\n"), e.referenceIds.length > 0) {
		t += "  reference {\n";
		for (let n of e.referenceIds) t += "    " + n + "\n";
		t += "  }\n";
	}
	return t += "}\n", t;
};
//#endregion
//#region packages/primmel/src/ser-des/config/index.ts
function W(e) {
	return e;
}
var G = [
	W({
		keyword: "role",
		field: "roles",
		takesID: !0,
		parse: ye,
		dump: be
	}),
	W({
		keyword: "provision",
		field: "provisions",
		takesID: !0,
		parse: N,
		resolve: P,
		dump: F
	}),
	W({
		keyword: "process",
		field: "processes",
		takesID: !0,
		parse: A,
		resolve: j,
		dump: M
	}),
	W({
		keyword: "approval",
		field: "approvals",
		takesID: !0,
		parse: re,
		resolve: ie,
		dump: ae
	}),
	W({
		keyword: "class",
		field: "dataclasses",
		takesID: !0,
		parse: le,
		resolve: de,
		dump: pe
	}),
	W({
		keyword: "enum",
		field: "enums",
		takesID: !0,
		parse: oe,
		dump: ge
	}),
	W({
		keyword: "data_registry",
		field: "regs",
		takesID: !0,
		parse: ce,
		resolve: fe,
		dump: _e
	}),
	W({
		keyword: "variable",
		field: "variables",
		takesID: !0,
		parse: g,
		dump: _
	}),
	W({
		keyword: "exclusive_gateway",
		field: "gateways",
		takesID: !0,
		parse: D,
		dump: O
	}),
	W({
		keyword: "start",
		aliases: ["start_event"],
		field: "events",
		takesID: !0,
		parse: b,
		dump: S
	}),
	W({
		keyword: "end",
		aliases: ["end_event"],
		field: "events",
		takesID: !0,
		parse: v,
		dump: S
	}),
	W({
		keyword: "signalcatch",
		aliases: ["signal_catch_event"],
		field: "events",
		takesID: !0,
		parse: y,
		dump: S
	}),
	W({
		keyword: "timer",
		aliases: ["timer_event"],
		field: "events",
		takesID: !0,
		parse: x,
		dump: S
	}),
	W({
		keyword: "reference",
		field: "references",
		takesID: !0,
		parse: I,
		dump: ve
	}),
	W({
		keyword: "canvas",
		aliases: ["subprocess"],
		field: "pages",
		takesID: !0,
		parse: xe,
		resolve: Ee,
		dump: Oe
	}),
	W({
		keyword: "note",
		field: "notes",
		takesID: !0,
		parse: Ae,
		resolve: je,
		dump: Me
	}),
	W({
		keyword: "table",
		field: "tables",
		takesID: !0,
		parse: Ne,
		dump: Fe
	}),
	W({
		keyword: "figure",
		field: "figures",
		takesID: !0,
		parse: Ie,
		dump: Le
	}),
	W({
		keyword: "link",
		field: "links",
		takesID: !0,
		parse: Re,
		dump: ze
	}),
	W({
		keyword: "map_profile",
		field: "mapProfiles",
		takesID: !0,
		parse: Be,
		dump: Ve
	}),
	W({
		keyword: "view_profile",
		field: "viewProfiles",
		takesID: !0,
		parse: He,
		dump: Ue
	}),
	W({
		keyword: "term",
		field: "terms",
		takesID: !0,
		parse: lt,
		dump: ut
	}),
	W({
		keyword: "form",
		field: "forms",
		takesID: !0,
		parse: We,
		dump: Je
	}),
	W({
		keyword: "subform",
		field: "subforms",
		takesID: !0,
		parse: Ye,
		dump: Ze
	}),
	W({
		keyword: "symbol",
		field: "symbols",
		takesID: !0,
		parse: Qe,
		resolve: $e,
		dump: et
	}),
	W({
		keyword: "calculation",
		field: "calculations",
		takesID: !0,
		parse: tt,
		resolve: it,
		dump: at
	}),
	W({
		keyword: "state_machine",
		field: "stateMachines",
		takesID: !0,
		parse: ot,
		dump: ct
	})
];
function dt(e) {
	let t = {};
	for (let n of e) {
		if (!n.field) continue;
		let e = {
			takesID: n.takesID,
			parse: n.parse,
			field: n.field
		};
		t[n.keyword] = e;
		for (let r of n.aliases ?? []) t[r] = e;
	}
	return t;
}
function ft(e) {
	let t = {};
	for (let n of e) n.field && (t[n.field] = { resolve: n.resolve ?? ((e, t) => t) });
	return t;
}
function pt(e) {
	let t = {};
	for (let n of e) n.field && (t[n.field] = n.dump);
	return t;
}
var K = {
	root: { parse: (e) => (t) => (t.root = e.trim(), t) },
	metadata: { parse: ee },
	...dt(G)
}, q = ft(G), mt = pt(G), J = (/* @__PURE__ */ e(((e, t) => {
	t.exports = {};
})))(), Y = /^include\s+"([^"]+)"/gm, ht = /^[ \t]*(#|\/\/)/;
function X(e, t = /* @__PURE__ */ new Set()) {
	let n = (0, J.resolve)(e);
	if (t.has(n)) throw Error(`Include cycle detected: ${n} (chain: ${[...t, n].map((e) => e.split("/").pop()).join(" → ")})`);
	if (t.add(n), !(0, J.existsSync)(n)) throw Error(`Include file not found: ${n}`);
	let r = (0, J.readFileSync)(n, "utf8"), i = (0, J.dirname)(n);
	return r.replace(Y, (e, n) => {
		let a = Y.lastIndex, o = r.lastIndexOf("\n", a - e.length) + 1, s = r.slice(o, a - e.length);
		if (ht.test(s)) return e;
		let c = (0, J.isAbsolute)(n) ? n : (0, J.resolve)(i, n);
		return X(c.endsWith(".mmel") ? c : `${c}.mmel`, new Set(t));
	});
}
//#endregion
//#region packages/primmel/src/validate.ts
function gt(e) {
	let t = [];
	for (let n of _t) t.push(...n.check(e));
	return t;
}
var _t = [
	{
		name: "empty-ids",
		check: vt
	},
	{
		name: "form-references",
		check: yt
	},
	{
		name: "state-machine-cascades",
		check: bt
	}
];
function vt(e) {
	let t = [];
	for (let [n, r] of Z(e)) for (let e of r) (!e.id || e.id.trim() === "") && t.push({
		severity: "error",
		code: "empty-id",
		construct: n,
		message: `${n} has an empty id — every ${n} must declare a non-empty id`
	});
	return t;
}
function yt(e) {
	let t = [], n = new Set(e.calculations.map((e) => e.id)), r = new Set(e.processes.map((e) => e.id)), i = new Set(e.subforms.map((e) => e.id));
	for (let a of e.forms) {
		a.conformanceProcessId && !r.has(a.conformanceProcessId) && t.push({
			severity: "error",
			code: "form-conformance-process-missing",
			construct: "form",
			message: `Form "${a.id}" references conformance process "${a.conformanceProcessId}" which does not exist`,
			id: a.id
		});
		for (let e of xt(a)) e.calculationId && !n.has(e.calculationId) && t.push({
			severity: "error",
			code: "form-calculation-missing",
			construct: "form",
			message: `Form "${a.id}" field "${e.name}" references calculation "${e.calculationId}" which does not exist`,
			id: a.id
		}), e.subformRef && !i.has(e.subformRef.subformId) && t.push({
			severity: "error",
			code: "form-subform-missing",
			construct: "form",
			message: `Form "${a.id}" field "${e.name}" references subform "${e.subformRef.subformId}" which does not exist`,
			id: a.id
		});
	}
	return t;
}
function bt(e) {
	let t = [];
	for (let n of e.stateMachines) {
		let e = new Set(n.states.map((e) => e.name));
		e.add("*");
		for (let r of n.transitions) r.from && !e.has(r.from) && t.push({
			severity: "warning",
			code: "state-machine-from-missing",
			construct: "state_machine",
			message: `State machine "${n.entityName}" transition from "${r.from}" is not in declared states`,
			id: n.entityName
		}), r.to && !e.has(r.to) && t.push({
			severity: "warning",
			code: "state-machine-to-missing",
			construct: "state_machine",
			message: `State machine "${n.entityName}" transition to "${r.to}" is not in declared states`,
			id: n.entityName
		});
	}
	return t;
}
function* Z(e) {
	for (let [t, n] of Object.entries(e)) Array.isArray(n) && n.length > 0 && typeof n[0]?.id == "string" && (yield [t, n]);
}
function* xt(e) {
	let t = [...e.fields];
	for (; t.length > 0;) {
		let e = t.pop();
		yield e, e.fields && e.fields.length > 0 && t.push(...e.fields);
	}
}
//#endregion
//#region packages/primmel/src/ser-des/index.ts
function Q(e, t = {}) {
	return f(l(e, K, t), q);
}
function $(e, t = {}) {
	let n = l(e, K, t);
	return {
		standard: f(n, q),
		issues: n.issues
	};
}
function St(e, t = {}) {
	return Q(X(e), t);
}
function Ct(e, t = {}) {
	return $(X(e), t);
}
function wt(e) {
	return p(e, mt);
}
function Tt(e) {
	return gt(e);
}
//#endregion
export { wt as dump, Q as load, St as loadFile, Ct as loadFileWithIssues, $ as loadWithIssues, Tt as validate };
