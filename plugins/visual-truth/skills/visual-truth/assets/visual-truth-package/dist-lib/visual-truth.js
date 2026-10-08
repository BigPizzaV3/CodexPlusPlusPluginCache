import { useCallback as e, useEffect as t, useMemo as n, useRef as r, useState as i } from "react";
import { AlignCenter as a, AlignHorizontalDistributeCenter as o, AlignHorizontalJustifyCenter as s, AlignHorizontalJustifyEnd as c, AlignHorizontalJustifyStart as l, AlignHorizontalSpaceAround as u, AlignLeft as d, AlignRight as f, AlignVerticalDistributeCenter as p, AlignVerticalJustifyCenter as m, AlignVerticalJustifyEnd as ee, AlignVerticalJustifyStart as h, ArrowDown as te, ArrowLeft as g, ArrowRight as _, ArrowUp as v, Blocks as y, Bold as b, Box as ne, Boxes as re, Check as ie, CheckCircle2 as ae, ChevronDown as oe, ChevronLeft as se, ChevronRight as ce, ChevronUp as x, ChevronsUpDown as S, CircleAlert as le, ClipboardCopy as ue, ClipboardPaste as de, Clock3 as C, Code2 as w, Columns2 as fe, Columns3 as pe, Command as me, Copy as T, CopyPlus as he, CornerDownRight as ge, CornerUpLeft as _e, Crop as ve, Crosshair as ye, Database as be, Download as xe, Edit3 as Se, Eraser as Ce, ExternalLink as we, Eye as E, EyeOff as Te, FileText as Ee, Focus as De, FolderPlus as Oe, Grid3X3 as ke, GripVertical as Ae, Group as je, Hand as Me, Heading2 as Ne, Image as Pe, ImageUp as Fe, Info as D, Italic as Ie, Layers3 as Le, LayoutGrid as Re, LayoutPanelTop as ze, Library as Be, Link2 as Ve, List as O, ListTree as k, LocateFixed as He, LockKeyhole as Ue, Magnet as We, Maximize as Ge, Maximize2 as A, MessageSquareText as j, Minus as M, Monitor as Ke, MoreHorizontal as N, MousePointer2 as qe, MousePointerClick as Je, Move as P, MoveHorizontal as Ye, MoveVertical as F, Paintbrush as I, Palette as Xe, PanelsTopLeft as L, Plus as Ze, Redo2 as Qe, RefreshCw as $e, RotateCcw as et, Save as tt, Scan as nt, Search as rt, Send as it, Settings2 as at, ShieldCheck as ot, SlidersHorizontal as st, Smartphone as ct, Sparkles as lt, SquareDashed as ut, SquareStack as dt, TableProperties as ft, Tablet as pt, Trash2 as mt, Type as ht, Underline as gt, Undo2 as _t, Ungroup as vt, UnlockKeyhole as R, Upload as yt, X as bt } from "lucide-react";
import { Fragment as z, jsx as B, jsxs as V } from "react/jsx-runtime";
//#region src/visual-truth/dom.ts
function xt(e) {
	return e instanceof Element && !!e.closest("[data-visual-truth-ui]");
}
function St(e) {
	if (!(e instanceof Element)) return null;
	if (!(e instanceof HTMLElement)) return e.closest("button, a, label, [role=\"button\"]");
	if (e.matches("span, strong, em, b, i, small")) {
		let t = e.closest("button, a, label, [role=\"button\"]");
		if (t) return t;
	}
	return e;
}
function Ct(e) {
	let t = e.dataset.vtLabel || e.getAttribute("aria-label") || e.getAttribute("alt") || e.getAttribute("title");
	if (t) return t;
	if (e.matches("div, span") && e.classList.length) return `.${[...e.classList].filter((e) => !e.startsWith("vt-")).slice(0, 3).join(".")}`;
	let n = e.innerText?.trim().replace(/\s+/g, " ");
	return n && n.length <= 64 ? n : n ? `${n.slice(0, 45).trim()}...` : e.tagName.toLowerCase();
}
function wt(e) {
	let t = e.dataset.vtLabel || e.getAttribute("aria-label") || e.getAttribute("alt") || e.getAttribute("title");
	if (t && t.length <= 48) return t;
	let n = e.tagName.toLowerCase();
	if (n === "main") return "Page";
	if (n === "header") return "Header";
	if (n === "nav") return "Navigation";
	if (n === "footer") return "Footer";
	if (n === "form") return "Form";
	if (n === "h1") return "Page heading";
	if (/^h[2-6]$/.test(n)) return "Heading";
	if (n === "p" || n === "blockquote" || n === "figcaption") return "Text";
	if (n === "img" || n === "picture" || n === "video" || n === "canvas" || e.getAttribute("role") === "img") return n === "img" ? "Image" : "Media";
	if (n === "button" || e.getAttribute("role") === "button") return "Button";
	if (n === "a") return e.closest("nav") ? "Navigation link" : "Link";
	if (n === "ul" || n === "ol") return "List";
	if (n === "li") return "List item";
	if (n === "section") {
		let t = e.id.replaceAll("-", " ").trim();
		if (t) return `${Tt(t)} section`;
		let n = [...e.classList].find((e) => /hero|service|about|contact|feature|client|testimonial|pricing|footer/i.test(e));
		if (n) return `${Tt(n.replaceAll("-", " "))} section`;
		let r = e.querySelector("h1, h2, h3")?.innerText.trim().replace(/\s+/g, " ");
		return r && r.length <= 36 ? `${r} section` : "Section";
	}
	if (n === "article") return "Card";
	if (n === "aside") return "Sidebar";
	if (n === "div") {
		let t = [...e.classList].find((e) => /hero|copy|content|buttons|actions|image|media|grid|row|column|card|brand/i.test(e));
		return t ? Tt(t.replaceAll("-", " ")) : "Container";
	}
	let r = e.innerText?.trim().replace(/\s+/g, " ");
	return r && r.length <= 36 ? r : Tt(n);
}
function Tt(e) {
	return e.replace(/\b\w/g, (e) => e.toUpperCase());
}
function H(e) {
	if (e === document.body) return "body";
	if (e === document.documentElement) return "html";
	if (e.id) return `#${CSS.escape(e.id)}`;
	if (e.dataset.vtId) return `[data-vt-id="${CSS.escape(e.dataset.vtId)}"]`;
	let t = e.dataset.vtLabel;
	if (t) return `[data-vt-label="${CSS.escape(t)}"]`;
	let n = [], r = e;
	for (; r && r !== document.body;) {
		let e = r.tagName.toLowerCase(), t = [...r.classList].filter((e) => !e.startsWith("vt-")).slice(0, 2);
		t.length && (e += `.${t.map((e) => CSS.escape(e)).join(".")}`);
		let i = r.parentElement;
		if (i) {
			let t = [...i.children].filter((e) => e.tagName === r?.tagName);
			t.length > 1 && (e += `:nth-of-type(${t.indexOf(r) + 1})`);
		}
		n.unshift(e), r = i;
	}
	return n.join(" > ");
}
function U(e) {
	return Number.parseFloat(e) || 0;
}
function Et(e) {
	let t = e.style.translate || getComputedStyle(e).translate;
	if (t && t !== "none") {
		let e = t.match(/-?[\d.]+/g)?.map(Number) ?? [];
		return {
			x: e[0] || 0,
			y: e[1] || 0
		};
	}
	let n = e.style.transform.match(/^translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)$/);
	return n ? {
		x: Number(n[1]),
		y: Number(n[2])
	} : {
		x: 0,
		y: 0
	};
}
function Dt(e) {
	let t = e.getBoundingClientRect(), n = getComputedStyle(e), r = Et(e), i = U(n.fontSize), a = U(n.lineHeight);
	return {
		x: Math.round(t.x),
		y: Math.round(t.y),
		translateX: Math.round(r.x),
		translateY: Math.round(r.y),
		width: Math.round(t.width),
		height: Math.round(t.height),
		marginTop: U(n.marginTop),
		marginRight: U(n.marginRight),
		marginBottom: U(n.marginBottom),
		marginLeft: U(n.marginLeft),
		paddingTop: U(n.paddingTop),
		paddingRight: U(n.paddingRight),
		paddingBottom: U(n.paddingBottom),
		paddingLeft: U(n.paddingLeft),
		fontSize: i,
		fontFamily: n.fontFamily,
		fontWeight: n.fontWeight,
		letterSpacing: U(n.letterSpacing),
		lineHeight: a && i ? a / i : 1.2,
		color: n.color,
		backgroundColor: n.backgroundColor,
		backgroundImage: n.backgroundImage,
		backgroundSize: n.backgroundSize,
		backgroundPosition: n.backgroundPosition,
		backgroundRepeat: n.backgroundRepeat,
		borderRadius: U(n.borderRadius),
		borderWidth: U(n.borderTopWidth),
		borderStyle: n.borderTopStyle,
		borderColor: n.borderTopColor,
		boxShadow: n.boxShadow,
		opacity: Number.parseFloat(n.opacity),
		textAlign: n.textAlign,
		objectFit: n.objectFit,
		objectPosition: n.objectPosition,
		display: n.display,
		flexDirection: n.flexDirection,
		justifyContent: n.justifyContent,
		alignItems: n.alignItems,
		gap: U(n.gap),
		gridTemplateColumns: n.gridTemplateColumns
	};
}
function Ot(e, t, n, r, i = r) {
	return {
		id: crypto.randomUUID(),
		selector: H(e),
		label: Ct(e),
		property: `attribute:${t}`,
		previousValue: n,
		value: i,
		runtimeValue: r,
		previousRuntimeValue: n,
		timestamp: Date.now(),
		kind: "attribute"
	};
}
function kt(e, t, n, r, i = r) {
	return {
		id: crypto.randomUUID(),
		selector: H(e),
		label: Ct(e),
		property: t,
		previousValue: n,
		value: i,
		runtimeValue: r,
		previousRuntimeValue: n,
		timestamp: Date.now(),
		kind: t === "text-content" ? "text" : "style"
	};
}
function At(e, t, n, r, i, a = r) {
	return {
		id: crypto.randomUUID(),
		selector: H(e),
		label: Ct(e),
		property: t,
		previousValue: n,
		value: a,
		runtimeValue: r,
		previousRuntimeValue: n,
		timestamp: Date.now(),
		kind: "responsive-style",
		device: i
	};
}
function jt(e, t, n, r, i, a, o) {
	let s = Ct(e), c = Ct(n), l = t === "insert" ? "add-element" : t === "remove" ? "remove-element" : "reorder-element", u = t === "insert" ? `Add ${s} inside ${c} at position ${r + 1}` : t === "remove" ? `Remove ${s} from ${c}` : a && a !== n ? `Move ${s} from ${Ct(a)} into ${c} at position ${r + 1}` : `Move ${s} from position ${(i ?? r) + 1} to ${r + 1} inside ${c}`;
	return {
		id: crypto.randomUUID(),
		selector: H(e),
		previousSelector: o,
		label: s,
		property: l,
		previousValue: t === "remove" ? e.outerHTML : t === "reorder" ? String((i ?? r) + 1) : "not present",
		value: u,
		timestamp: Date.now(),
		kind: t,
		parentSelector: H(n),
		previousParentSelector: a ? H(a) : void 0,
		stableId: e.dataset.vtId,
		index: r,
		previousIndex: i,
		html: e.outerHTML
	};
}
function Mt(e, t, n) {
	if (t === "text-content") {
		e.innerText = n;
		return;
	}
	if (t.startsWith("attribute:")) {
		let r = t.slice(10);
		n ? e.setAttribute(r, n) : e.removeAttribute(r);
		return;
	}
	e.style.setProperty(t, n);
}
function Nt(e) {
	return !e || e.matches("img, video, svg, canvas, input, textarea, select") ? !1 : e.matches("h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, blockquote, figcaption") ? !0 : e.childElementCount === 0 && !!e.innerText.trim();
}
function Pt(e, t = "", n = "") {
	let r = /* @__PURE__ */ new Map();
	for (let t of e) r.set(`${t.device ?? "all"}:${t.selector}:${t.property}`, t);
	let i = /* @__PURE__ */ new Map();
	for (let e of r.values()) {
		let t = i.get(e.selector) ?? [];
		t.push(e), i.set(e.selector, t);
	}
	let a = [
		"Apply these Visual Truth edits to the real source components and styles.",
		"Treat the recorded rendered values as the visual source of truth. Preserve responsive behavior and avoid unrelated changes.",
		`Route: ${window.location.pathname}`,
		`Viewport: ${window.innerWidth} x ${window.innerHeight} CSS pixels at 100%`,
		n ? `Responsive review: ${n}` : "",
		""
	].filter((e, t, n) => e || t === n.length - 1);
	t.trim() && (a.push("Derek's note:"), a.push(t.trim()), a.push(""));
	for (let [e, t] of i) {
		let n = t.find((e) => e.previousSelector)?.previousSelector;
		a.push(`${t[0].label} (${e}${n && n !== e ? `; original path: ${n}` : ""})`);
		for (let e of t) e.kind === "insert" || e.kind === "remove" ? a.push(`- ${e.property}: ${e.value}`) : a.push(`- ${e.device ? `[${e.device}] ` : ""}${e.property}: ${e.value} (was ${e.previousValue || "unset"})`);
		a.push("");
	}
	return a.push("After implementing, compare the live page at the recorded viewport and confirm each geometry change visually."), a.join("\n");
}
//#endregion
//#region src/visual-truth/ElementContextMenu.tsx
function Ft({ position: e, canEditText: t, canPasteStyles: n, canPasteElement: r, canRestructure: i, multiSelected: a, grouped: o, locked: s, onEditText: c, onCopyStyles: l, onPasteStyles: u, onCopyElement: d, onPasteElement: f, onMoveLayer: p, onMoveSibling: m, onDuplicate: ee, onRemove: h, onHide: g, onReset: _, onRename: y, onLock: b, onSaveSection: ne, onGroup: re, onUngroup: ie, onMakeItCode: ae }) {
	let se = Math.min(610, window.innerHeight - 16);
	return /* @__PURE__ */ V("div", {
		className: "vt-context-menu",
		"data-visual-truth-ui": !0,
		role: "menu",
		style: {
			left: Math.max(8, Math.min(window.innerWidth - 220 - 8, e.x)),
			top: Math.max(8, Math.min(window.innerHeight - se - 8, e.y))
		},
		children: [
			/* @__PURE__ */ V("button", {
				onClick: c,
				disabled: !t,
				children: [/* @__PURE__ */ B(ht, { size: 15 }), /* @__PURE__ */ B("span", { children: "Edit text" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: y,
				children: [/* @__PURE__ */ B(Se, { size: 15 }), /* @__PURE__ */ B("span", { children: "Rename layer" })]
			}),
			/* @__PURE__ */ B("i", {}),
			/* @__PURE__ */ V("button", {
				onClick: l,
				children: [/* @__PURE__ */ B(ue, { size: 15 }), /* @__PURE__ */ B("span", { children: "Copy style" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: u,
				disabled: !n,
				children: [/* @__PURE__ */ B(de, { size: 15 }), /* @__PURE__ */ B("span", { children: "Paste style" })]
			}),
			/* @__PURE__ */ B("i", {}),
			/* @__PURE__ */ V("button", {
				onClick: d,
				children: [/* @__PURE__ */ B(ue, { size: 15 }), /* @__PURE__ */ B("span", { children: "Copy element" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: f,
				disabled: !r,
				children: [/* @__PURE__ */ B(de, { size: 15 }), /* @__PURE__ */ B("span", { children: "Paste element" })]
			}),
			/* @__PURE__ */ B("i", {}),
			/* @__PURE__ */ V("button", {
				onClick: ee,
				disabled: !i,
				children: [/* @__PURE__ */ B(T, { size: 15 }), /* @__PURE__ */ B("span", { children: "Duplicate" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: ne,
				children: [/* @__PURE__ */ B(Be, { size: 15 }), /* @__PURE__ */ B("span", { children: "Save as reusable section" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: o ? ie : re,
				disabled: !a,
				children: [B(o ? vt : je, { size: 15 }), /* @__PURE__ */ B("span", { children: o ? "Ungroup selection" : "Group selection" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: () => m(-1),
				disabled: !i,
				children: [/* @__PURE__ */ B(x, { size: 15 }), /* @__PURE__ */ B("span", { children: "Move up in section" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: () => m(1),
				disabled: !i,
				children: [/* @__PURE__ */ B(oe, { size: 15 }), /* @__PURE__ */ B("span", { children: "Move down in section" })]
			}),
			/* @__PURE__ */ B("i", {}),
			/* @__PURE__ */ V("button", {
				onClick: () => p(1),
				children: [/* @__PURE__ */ B(v, { size: 15 }), /* @__PURE__ */ B("span", { children: "Bring forward" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: () => p(-1),
				children: [/* @__PURE__ */ B(te, { size: 15 }), /* @__PURE__ */ B("span", { children: "Send backward" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: g,
				children: [/* @__PURE__ */ B(Te, { size: 15 }), /* @__PURE__ */ B("span", { children: "Hide element" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: b,
				children: [B(s ? R : Ue, { size: 15 }), /* @__PURE__ */ B("span", { children: s ? "Unlock element" : "Lock element" })]
			}),
			/* @__PURE__ */ B("i", {}),
			/* @__PURE__ */ V("button", {
				onClick: _,
				children: [/* @__PURE__ */ B(et, { size: 15 }), /* @__PURE__ */ B("span", { children: "Reset this element" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: ae,
				children: [/* @__PURE__ */ B(w, { size: 15 }), /* @__PURE__ */ B("span", { children: "Make It Code" })]
			}),
			/* @__PURE__ */ V("button", {
				className: "danger",
				onClick: h,
				disabled: !i,
				children: [/* @__PURE__ */ B(mt, { size: 15 }), /* @__PURE__ */ B("span", { children: "Remove element" })]
			})
		]
	});
}
//#endregion
//#region src/visual-truth/ElementsPanel.tsx
var It = [
	{
		kind: "heading",
		label: "Heading",
		group: "Basic",
		icon: Ne
	},
	{
		kind: "text",
		label: "Text",
		group: "Basic",
		icon: ht
	},
	{
		kind: "button",
		label: "Button",
		group: "Basic",
		icon: Je
	},
	{
		kind: "image",
		label: "Image",
		group: "Basic",
		icon: Pe
	},
	{
		kind: "divider",
		label: "Divider",
		group: "Basic",
		icon: M
	},
	{
		kind: "spacer",
		label: "Spacer",
		group: "Basic",
		icon: F
	},
	{
		kind: "list",
		label: "List",
		group: "Basic",
		icon: O
	},
	{
		kind: "card",
		label: "Card",
		group: "Layout",
		icon: L
	},
	{
		kind: "section",
		label: "Section",
		group: "Layout",
		icon: dt
	},
	{
		kind: "columns-2",
		label: "2 columns",
		group: "Layout",
		icon: fe
	},
	{
		kind: "columns-3",
		label: "3 columns",
		group: "Layout",
		icon: pe
	}
];
function Lt({ targetLabel: e, placement: t, onAdd: r, onClose: a, sections: o = [], onInsertSection: s }) {
	let [c, l] = i(""), [u, d] = i(() => {
		try {
			return JSON.parse(window.localStorage.getItem("visual-truth:recent-elements") ?? "[]");
		} catch {
			return [];
		}
	}), f = n(() => It.filter((e) => e.label.toLowerCase().includes(c.trim().toLowerCase())), [c]), p = (e) => {
		let t = [e, ...u.filter((t) => t !== e)].slice(0, 4);
		d(t), window.localStorage.setItem("visual-truth:recent-elements", JSON.stringify(t)), r(e);
	};
	return /* @__PURE__ */ V("aside", {
		className: "vt-elements",
		"data-visual-truth-ui": !0,
		children: [
			/* @__PURE__ */ V("header", { children: [
				/* @__PURE__ */ B(Ze, { size: 16 }),
				/* @__PURE__ */ B("strong", { children: "Elements" }),
				/* @__PURE__ */ B("button", {
					onClick: a,
					title: "Return to layers",
					children: /* @__PURE__ */ B(bt, { size: 15 })
				})
			] }),
			/* @__PURE__ */ V("div", {
				className: "vt-element-search",
				children: [/* @__PURE__ */ B(rt, { size: 14 }), /* @__PURE__ */ B("input", {
					"aria-label": "Search elements",
					value: c,
					onChange: (e) => l(e.target.value),
					placeholder: "Search elements"
				})]
			}),
			/* @__PURE__ */ V("div", {
				className: "vt-insert-target",
				children: [/* @__PURE__ */ V("span", { children: ["Add ", t] }), /* @__PURE__ */ B("strong", { children: e })]
			}),
			/* @__PURE__ */ V("div", {
				className: "vt-widget-list",
				children: [
					u.length ? /* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("h3", { children: "Recently used" }), /* @__PURE__ */ B("div", {
						className: "vt-widget-grid",
						children: u.map((e) => {
							let t = It.find((t) => t.kind === e);
							if (!t) return null;
							let n = t.icon;
							return /* @__PURE__ */ V("button", {
								onClick: () => p(e),
								children: [/* @__PURE__ */ B(n, { size: 24 }), /* @__PURE__ */ B("span", { children: t.label })]
							}, e);
						})
					})] }) : null,
					o.length ? /* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("h3", { children: "Saved sections" }), /* @__PURE__ */ B("div", {
						className: "vt-saved-section-list",
						children: o.slice(0, 4).map((e) => /* @__PURE__ */ V("button", {
							onClick: () => s?.(e),
							children: [/* @__PURE__ */ B("span", {
								className: "vt-section-thumb",
								children: /* @__PURE__ */ B(dt, { size: 22 })
							}), /* @__PURE__ */ B("strong", { children: e.name })]
						}, e.id))
					})] }) : null,
					["Basic", "Layout"].map((e) => {
						let t = f.filter((t) => t.group === e);
						return t.length ? /* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("h3", { children: e }), /* @__PURE__ */ B("div", {
							className: "vt-widget-grid",
							children: t.map((e) => {
								let t = e.icon;
								return /* @__PURE__ */ V("button", {
									draggable: !0,
									onDragStart: (t) => t.dataTransfer.setData("application/x-visual-truth-element", e.kind),
									onClick: () => p(e.kind),
									children: [/* @__PURE__ */ B(t, { size: 25 }), /* @__PURE__ */ B("span", { children: e.label })]
								}, e.kind);
							})
						})] }, e) : null;
					}),
					f.length ? null : /* @__PURE__ */ B("div", {
						className: "vt-elements-empty",
						children: "No matching elements."
					})
				]
			})
		]
	});
}
//#endregion
//#region src/visual-truth/Inspector.tsx
function W({ label: e, value: t, onChange: n, suffix: r = "px", step: i = 1 }) {
	return /* @__PURE__ */ V("label", {
		className: "vt-number-field",
		children: [/* @__PURE__ */ B("span", { children: e }), /* @__PURE__ */ B("input", {
			type: "number",
			step: i,
			value: i < 1 ? t.toFixed(2) : Math.round(t),
			onChange: (e) => n(`${e.target.value}${r}`)
		})]
	});
}
var G = [
	["structure", "Structure"],
	["visibility", "Show on devices"],
	["layout", "Layout"],
	["position", "Position"],
	["size", "Size"],
	["spacing", "Spacing"],
	["typography", "Typography"],
	["link", "Link"],
	["media", "Image & media"],
	["background", "Background image"],
	["appearance", "Appearance"]
], Rt = "visual-truth:inspector-preferences:v1", zt = 260, Bt = (e) => Math.min(420, Math.max(240, typeof e == "number" && Number.isFinite(e) ? e : zt)), Vt = () => G.map(([e]) => e), Ht = () => Object.fromEntries(G.map(([e]) => [e, !0]));
function Ut(e) {
	let t = new Set(Vt()), n = Array.isArray(e) ? e.filter((e) => typeof e == "string" && t.has(e)) : [], r = [...new Set(n)];
	return [...r, ...Vt().filter((e) => !r.includes(e))];
}
function Wt() {
	let e = {
		open: Ht(),
		visible: Ht(),
		order: Vt(),
		solo: !1,
		width: zt
	};
	if (typeof window > "u") return e;
	try {
		let t = JSON.parse(window.localStorage.getItem(Rt) ?? "{}");
		return {
			open: {
				...e.open,
				...t.open
			},
			visible: {
				...e.visible,
				...t.visible
			},
			order: Ut(t.order),
			solo: t.solo === !0,
			width: Bt(t.width)
		};
	} catch {
		return e;
	}
}
function Gt({ id: e, title: t, children: n, open: r, visible: i, order: a, onToggle: o }) {
	if (!i) return null;
	let s = `vt-inspector-${e}`;
	return /* @__PURE__ */ V("section", {
		className: `vt-inspector-section${r ? " open" : " collapsed"}`,
		style: { order: a },
		children: [/* @__PURE__ */ V("button", {
			className: "vt-section-heading",
			"aria-expanded": r,
			"aria-controls": s,
			onClick: o,
			children: [/* @__PURE__ */ B("h3", { children: t }), /* @__PURE__ */ B(oe, { size: 14 })]
		}), r ? /* @__PURE__ */ B("div", {
			id: s,
			className: "vt-section-content",
			children: n
		}) : null]
	});
}
var Kt = [
	["Arial", "Arial, sans-serif"],
	["DM Sans", "\"DM Sans\", sans-serif"],
	["Georgia", "Georgia, serif"],
	["Helvetica", "Helvetica, Arial, sans-serif"],
	["Manrope", "Manrope, sans-serif"],
	["Times", "\"Times New Roman\", serif"]
], qt = [
	["None", "none"],
	["Small", "0 2px 8px rgb(0 0 0 / 12%)"],
	["Medium", "0 8px 24px rgb(0 0 0 / 16%)"],
	["Large", "0 18px 48px rgb(0 0 0 / 20%)"]
];
function Jt(e) {
	return e === "none" ? "none" : e.includes("18px 48px") ? qt[3][1] : e.includes("8px 24px") ? qt[2][1] : e.includes("2px 8px") ? qt[1][1] : "current";
}
function Yt(e) {
	return !e || e === "none" ? "" : e.match(/^url\(["']?(.*?)["']?\)$/)?.[1] ?? "";
}
function Xt(e, t, n, r) {
	if (!e || !t || r === "all") return e;
	let i = H(t), a = { ...e }, o = (e) => Number.parseFloat(e) || 0;
	for (let e of n) {
		if (e.kind !== "responsive-style" || e.device !== r || e.selector !== i) continue;
		let t = e.runtimeValue ?? e.value;
		switch (e.property) {
			case "width":
				a.width = o(t);
				break;
			case "height":
				a.height = o(t);
				break;
			case "margin-top":
				a.marginTop = o(t);
				break;
			case "margin-right":
				a.marginRight = o(t);
				break;
			case "margin-bottom":
				a.marginBottom = o(t);
				break;
			case "margin-left":
				a.marginLeft = o(t);
				break;
			case "padding-top":
				a.paddingTop = o(t);
				break;
			case "padding-right":
				a.paddingRight = o(t);
				break;
			case "padding-bottom":
				a.paddingBottom = o(t);
				break;
			case "padding-left":
				a.paddingLeft = o(t);
				break;
			case "font-size":
				a.fontSize = o(t);
				break;
			case "font-family":
				a.fontFamily = t;
				break;
			case "font-weight":
				a.fontWeight = t;
				break;
			case "letter-spacing":
				a.letterSpacing = o(t);
				break;
			case "line-height":
				a.lineHeight = o(t);
				break;
			case "color":
				a.color = t;
				break;
			case "background-color":
				a.backgroundColor = t;
				break;
			case "background-image":
				a.backgroundImage = t;
				break;
			case "background-size":
				a.backgroundSize = t;
				break;
			case "background-position":
				a.backgroundPosition = t;
				break;
			case "background-repeat":
				a.backgroundRepeat = t;
				break;
			case "border-radius":
				a.borderRadius = o(t);
				break;
			case "border-width":
				a.borderWidth = o(t);
				break;
			case "border-style":
				a.borderStyle = t;
				break;
			case "border-color":
				a.borderColor = t;
				break;
			case "box-shadow":
				a.boxShadow = t;
				break;
			case "opacity":
				a.opacity = o(t);
				break;
			case "text-align":
				a.textAlign = t;
				break;
			case "object-fit":
				a.objectFit = t;
				break;
			case "object-position":
				a.objectPosition = t;
				break;
			case "display":
				a.display = t;
				break;
			case "flex-direction":
				a.flexDirection = t;
				break;
			case "justify-content":
				a.justifyContent = t;
				break;
			case "align-items":
				a.alignItems = t;
				break;
			case "gap":
				a.gap = o(t);
				break;
			case "grid-template-columns":
				a.gridTemplateColumns = t;
				break;
			case "translate": {
				let e = t.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
				e && (a.translateX = Number(e[1]), a.translateY = Number(e[2]));
				break;
			}
			case "transform": {
				let e = t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
				e && (a.translateX = Number(e[1]), a.translateY = Number(e[2]));
				break;
			}
		}
	}
	return a;
}
function Zt({ label: e, value: t, placeholder: n, onCommit: r }) {
	return /* @__PURE__ */ V("label", {
		className: "vt-text-field",
		children: [/* @__PURE__ */ B("span", { children: e }), /* @__PURE__ */ B("input", {
			defaultValue: t,
			placeholder: n,
			onBlur: (e) => {
				let n = e.currentTarget.value.trim();
				n !== t && r(n);
			},
			onKeyDown: (e) => {
				e.key === "Enter" && e.currentTarget.blur();
			}
		}, t)]
	});
}
var Qt = [
	"left top",
	"center top",
	"right top",
	"left center",
	"center center",
	"right center",
	"left bottom",
	"center bottom",
	"right bottom"
];
function $t(e) {
	return e.replace(/^0%/, "left").replace(/^50%/, "center").replace(/^100%/, "right").replace(/0%$/, "top").replace(/50%$/, "center").replace(/100%$/, "bottom");
}
function en(e) {
	let [t, n] = e.split(" ");
	return t === "center" && n === "center" ? "center" : t === "center" ? n : n === "center" ? t : `${n} ${t}`;
}
function tn({ value: e, onChange: t }) {
	let n = $t(e);
	return /* @__PURE__ */ V("div", {
		className: "vt-focal-row",
		children: [/* @__PURE__ */ B("span", { children: "Focus" }), /* @__PURE__ */ B("div", {
			className: "vt-focal-grid",
			role: "group",
			"aria-label": "Image focal point",
			children: Qt.map((e) => /* @__PURE__ */ B("button", {
				className: n === e ? "active" : "",
				"aria-label": `Focus ${en(e)}`,
				title: `Focus ${en(e)}`,
				onClick: () => t(e),
				children: /* @__PURE__ */ B("i", {})
			}, e))
		})]
	});
}
function nn({ tab: e, onTabChange: a, selected: o, metrics: u, changes: d, checkpoints: f, copied: p, note: y, editScope: b, onEditScope: ne, onResetScope: re, aspectLocked: ae, onAspectLocked: oe, onStyle: x, onStyleAsset: S, onAttribute: le, onTranslate: ue, onAlign: de, onResize: w, onNudge: fe, onScale: pe, onFitParent: me, onCopy: he, onResetSelected: ve, onClear: ye, onRevertChange: be, onSaveCheckpoint: xe, onRestoreCheckpoint: Se, onDeleteCheckpoint: we, onNoteChange: Ee, onEditText: De, canEditText: Oe, onMoveSibling: ke, onMoveToParent: je, onSelectRelative: Me, onDuplicate: Ne, onRemove: Pe, canRestructure: D }) {
	u = Xt(u, o, d, b);
	let [Ie, Le] = i(1), [ze, Be] = i(""), [Ve, O] = i(""), [k, He] = i(""), [We, Ge] = i(!1), [j, N] = i(Wt), qe = r(null), Je = r(null), P = n(() => Ut(j.order), [j.order]), Ye = j.solo === !0, F = Bt(j.width);
	t(() => {
		window.localStorage.setItem(Rt, JSON.stringify({
			...j,
			order: P,
			solo: Ye,
			width: F
		}));
	}, [
		j,
		P,
		Ye,
		F
	]);
	let I = (e) => ({
		id: e,
		open: j.open[e],
		visible: j.visible[e],
		order: P.indexOf(e),
		onToggle: () => N((t) => {
			let n = !t.open[e];
			if (t.solo !== !0 || !n) return {
				...t,
				open: {
					...t.open,
					[e]: n
				}
			};
			let r = Object.fromEntries(G.map(([t]) => [t, t === e]));
			return {
				...t,
				open: r
			};
		})
	}), Xe = (e, t) => N((n) => ({
		...n,
		visible: {
			...n.visible,
			[e]: t
		}
	})), L = (e) => N((t) => ({
		...t,
		open: Object.fromEntries(G.map(([t]) => [t, e]))
	})), Qe = () => N((e) => ({
		...e,
		visible: Ht()
	})), $e = (e) => N((t) => {
		if (!e) return {
			...t,
			solo: e
		};
		let n = Ut(t.order).find((e) => t.visible[e] && t.open[e]), r = Object.fromEntries(G.map(([e]) => [e, e === n]));
		return {
			...t,
			solo: e,
			open: r
		};
	}), nt = (e, t) => N((n) => {
		let r = Ut(n.order), i = r.indexOf(e), a = i + t;
		if (i < 0 || a < 0 || a >= r.length) return n;
		let o = [...r];
		return [o[i], o[a]] = [o[a], o[i]], {
			...n,
			order: o
		};
	}), rt = () => N((e) => ({
		...e,
		order: Vt()
	})), at = (e) => {
		e.preventDefault();
		let t = e.clientX, n = F, r = (e) => N((r) => ({
			...r,
			width: Bt(n + t - e.clientX)
		})), i = () => {
			window.removeEventListener("pointermove", r), window.removeEventListener("pointerup", i), window.removeEventListener("pointercancel", i), document.body.classList.remove("vt-resizing-inspector");
		};
		document.body.classList.add("vt-resizing-inspector"), window.addEventListener("pointermove", r), window.addEventListener("pointerup", i), window.addEventListener("pointercancel", i);
	}, ot = [...d].reverse(), lt = o?.matches("img, video") ?? !1, ut = o?.matches("img") ?? !1, dt = o?.matches("a") ?? !1, ft = !!o?.childElementCount, gt = o?.getAttribute("data-vt-locked") === "true", _t = !o || getComputedStyle(o).visibility !== "hidden", vt = Kt.find(([e]) => u?.fontFamily.toLowerCase().includes(e.toLowerCase()))?.[1] ?? "current", yt = Jt(u?.boxShadow ?? "none"), bt = Yt(u?.backgroundImage ?? "none"), xt = o ? [...document.querySelectorAll("main, section, article, header, footer, nav, aside, div, form, ul, ol")].filter((e) => !e.closest("[data-visual-truth-ui]") && e !== o && !o.contains(e)).slice(0, 120) : [], St = o?.parentElement ? H(o.parentElement) : "", wt = o ? H(o) : "", Tt = {
		desktop: d.filter((e) => e.kind === "responsive-style" && e.device === "desktop" && e.selector === wt).length,
		tablet: d.filter((e) => e.kind === "responsive-style" && e.device === "tablet" && e.selector === wt).length,
		phone: d.filter((e) => e.kind === "responsive-style" && e.device === "phone" && e.selector === wt).length
	}, U = {
		desktop: o?.getAttribute("data-vt-hide-desktop") !== "true",
		tablet: o?.getAttribute("data-vt-hide-tablet") !== "true",
		phone: o?.getAttribute("data-vt-hide-phone") !== "true"
	}, Et = (e) => le(`data-vt-hide-${e}`, U[e] ? "true" : ""), Dt = (e) => {
		if (!e) return;
		if (e.size > 2e6) {
			Be("Choose an image under 2 MB for local session saving.");
			return;
		}
		let t = new FileReader();
		t.onload = () => {
			typeof t.result == "string" && (Be(""), le("src", t.result, `Use local image "${e.name}"`));
		}, t.onerror = () => Be("That image could not be read."), t.readAsDataURL(e);
	}, Ot = (e) => {
		if (!e) return;
		if (e.size > 2e6) {
			O("Choose an image under 2 MB for local session saving.");
			return;
		}
		let t = new FileReader();
		t.onload = () => {
			typeof t.result == "string" && (O(""), S("background-image", `url("${t.result}")`, `Use local background image "${e.name}"`));
		}, t.onerror = () => O("That image could not be read."), t.readAsDataURL(e);
	}, kt = () => {
		xe(k), He("");
	};
	return /* @__PURE__ */ V("aside", {
		className: "vt-inspector",
		"data-visual-truth-ui": !0,
		style: { "--vt-inspector-width": `${F}px` },
		children: [
			/* @__PURE__ */ B("button", {
				className: "vt-inspector-resize-handle",
				"aria-label": "Resize inspector panel",
				title: "Drag to resize. Double-click to reset.",
				onPointerDown: at,
				onDoubleClick: () => N((e) => ({
					...e,
					width: zt
				})),
				children: /* @__PURE__ */ B(Ae, { size: 12 })
			}),
			/* @__PURE__ */ V("div", {
				className: "vt-tabs",
				role: "tablist",
				children: [
					/* @__PURE__ */ B("button", {
						className: e === "design" ? "active" : "",
						onClick: () => a("design"),
						children: "Design"
					}),
					/* @__PURE__ */ V("button", {
						className: e === "changes" ? "active" : "",
						onClick: () => a("changes"),
						children: ["Changes ", /* @__PURE__ */ B("span", { children: d.length })]
					}),
					/* @__PURE__ */ B("button", {
						className: `vt-customize-trigger${We ? " active" : ""}`,
						"aria-label": "Customize inspector sections",
						"aria-expanded": We,
						title: "Customize inspector sections",
						onClick: () => Ge((e) => !e),
						children: /* @__PURE__ */ B(st, { size: 14 })
					})
				]
			}),
			We ? /* @__PURE__ */ V("div", {
				className: "vt-inspector-customize",
				role: "dialog",
				"aria-label": "Customize inspector sections",
				children: [
					/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B("strong", { children: "Inspector panels" }), /* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("button", {
						"aria-label": "Show all inspector panels",
						title: "Show all inspector panels",
						onClick: Qe,
						children: /* @__PURE__ */ B(E, { size: 13 })
					}), /* @__PURE__ */ B("button", {
						"aria-label": "Reset inspector panel order",
						title: "Reset inspector panel order",
						onClick: rt,
						children: /* @__PURE__ */ B(et, { size: 13 })
					})] })] }),
					/* @__PURE__ */ V("label", {
						className: "vt-inspector-solo",
						children: [
							/* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: "Solo mode" }), /* @__PURE__ */ B("small", { children: "Open one panel at a time" })] }),
							/* @__PURE__ */ B("input", {
								type: "checkbox",
								checked: Ye,
								onChange: (e) => $e(e.target.checked)
							}),
							/* @__PURE__ */ B("i", {})
						]
					}),
					/* @__PURE__ */ B("div", {
						className: "vt-inspector-panel-list",
						children: P.map((e, t) => {
							let n = G.find(([t]) => t === e)?.[1] ?? e;
							return /* @__PURE__ */ V("div", {
								className: "vt-inspector-panel-row",
								children: [/* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B("input", {
									type: "checkbox",
									checked: j.visible[e],
									onChange: (t) => Xe(e, t.target.checked)
								}), /* @__PURE__ */ B("span", { children: n })] }), /* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("button", {
									disabled: t === 0,
									"aria-label": `Move ${n} panel up`,
									title: "Move panel up",
									onClick: () => nt(e, -1),
									children: /* @__PURE__ */ B(v, { size: 12 })
								}), /* @__PURE__ */ B("button", {
									disabled: t === P.length - 1,
									"aria-label": `Move ${n} panel down`,
									title: "Move panel down",
									onClick: () => nt(e, 1),
									children: /* @__PURE__ */ B(te, { size: 12 })
								})] })]
							}, e);
						})
					}),
					/* @__PURE__ */ V("footer", { children: [/* @__PURE__ */ B("button", {
						onClick: () => L(!1),
						children: "Collapse all"
					}), /* @__PURE__ */ B("button", {
						onClick: () => L(!0),
						children: "Expand all"
					})] })
				]
			}) : null,
			e === "design" ? o && u ? /* @__PURE__ */ V("div", {
				className: "vt-inspector-body",
				children: [
					/* @__PURE__ */ V("div", {
						className: "vt-selection-name",
						children: [/* @__PURE__ */ B("strong", { children: o.dataset.vtLabel || o.tagName.toLowerCase() }), /* @__PURE__ */ B("code", { children: o.tagName.toLowerCase() })]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-selection-navigation",
						role: "group",
						"aria-label": "Select nearby element",
						children: [
							/* @__PURE__ */ V("button", {
								onClick: () => Me("parent"),
								title: "Select parent",
								children: [/* @__PURE__ */ B(_e, { size: 14 }), /* @__PURE__ */ B("span", { children: "Parent" })]
							}),
							/* @__PURE__ */ B("button", {
								onClick: () => Me("previous"),
								title: "Select previous sibling",
								children: /* @__PURE__ */ B(se, { size: 14 })
							}),
							/* @__PURE__ */ B("button", {
								onClick: () => Me("next"),
								title: "Select next sibling",
								children: /* @__PURE__ */ B(ce, { size: 14 })
							}),
							/* @__PURE__ */ V("button", {
								onClick: () => Me("child"),
								title: "Select first child",
								children: [/* @__PURE__ */ B(ge, { size: 14 }), /* @__PURE__ */ B("span", { children: "Child" })]
							})
						]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-edit-scope",
						children: [/* @__PURE__ */ B("strong", { children: "Apply to" }), /* @__PURE__ */ V("div", {
							role: "group",
							"aria-label": "Responsive edit scope",
							children: [
								/* @__PURE__ */ V("button", {
									className: b === "all" ? "active" : "",
									"aria-pressed": b === "all",
									onClick: () => ne("all"),
									title: "Apply changes to all devices",
									children: [/* @__PURE__ */ B(Re, { size: 13 }), /* @__PURE__ */ B("span", { children: "All" })]
								}),
								/* @__PURE__ */ V("button", {
									className: b === "desktop" ? "active" : "",
									"aria-pressed": b === "desktop",
									onClick: () => ne("desktop"),
									title: "Apply changes to desktop only",
									children: [
										/* @__PURE__ */ B(Ke, { size: 13 }),
										/* @__PURE__ */ B("span", { children: "Desktop" }),
										Tt.desktop ? /* @__PURE__ */ B("em", { children: Tt.desktop }) : null
									]
								}),
								/* @__PURE__ */ V("button", {
									className: b === "tablet" ? "active" : "",
									"aria-pressed": b === "tablet",
									onClick: () => ne("tablet"),
									title: "Apply changes to iPad only",
									children: [
										/* @__PURE__ */ B(pt, { size: 13 }),
										/* @__PURE__ */ B("span", { children: "iPad" }),
										Tt.tablet ? /* @__PURE__ */ B("em", { children: Tt.tablet }) : null
									]
								}),
								/* @__PURE__ */ V("button", {
									className: b === "phone" ? "active" : "",
									"aria-pressed": b === "phone",
									onClick: () => ne("phone"),
									title: "Apply changes to phone only",
									children: [
										/* @__PURE__ */ B(ct, { size: 13 }),
										/* @__PURE__ */ B("span", { children: "Phone" }),
										Tt.phone ? /* @__PURE__ */ B("em", { children: Tt.phone }) : null
									]
								})
							]
						})]
					}),
					b !== "all" && Tt[b] ? /* @__PURE__ */ V("button", {
						className: "vt-reset-scope",
						onClick: re,
						children: [
							/* @__PURE__ */ B(et, { size: 12 }),
							"Reset ",
							b === "tablet" ? "iPad" : b,
							" edits"
						]
					}) : null,
					Oe ? /* @__PURE__ */ V("button", {
						className: "vt-edit-text",
						onClick: De,
						children: [/* @__PURE__ */ B(ht, { size: 14 }), " Edit text on page"]
					}) : null,
					/* @__PURE__ */ V("div", {
						className: "vt-inspector-sections",
						children: [
							/* @__PURE__ */ V(Gt, {
								title: "Structure",
								...I("structure"),
								children: [/* @__PURE__ */ V("div", {
									className: "vt-structure-actions",
									children: [
										/* @__PURE__ */ B("button", {
											onClick: () => ke(-1),
											title: "Move up in section",
											"aria-label": "Move up in section",
											disabled: !D,
											children: /* @__PURE__ */ B(v, { size: 15 })
										}),
										/* @__PURE__ */ B("button", {
											onClick: () => ke(1),
											title: "Move down in section",
											"aria-label": "Move down in section",
											disabled: !D,
											children: /* @__PURE__ */ B(te, { size: 15 })
										}),
										/* @__PURE__ */ B("button", {
											onClick: Ne,
											title: "Duplicate element",
											"aria-label": "Duplicate element",
											disabled: !D,
											children: /* @__PURE__ */ B(T, { size: 15 })
										}),
										/* @__PURE__ */ B("button", {
											className: "danger",
											onClick: Pe,
											title: "Remove element",
											"aria-label": "Remove element",
											disabled: !D,
											children: /* @__PURE__ */ B(mt, { size: 15 })
										}),
										/* @__PURE__ */ B("button", {
											className: gt ? "active" : "",
											onClick: () => le("data-vt-locked", gt ? "" : "true"),
											title: gt ? "Unlock element" : "Lock element",
											"aria-label": gt ? "Unlock element" : "Lock element",
											children: B(gt ? Ue : R, { size: 15 })
										}),
										/* @__PURE__ */ B("button", {
											className: _t ? "" : "active",
											onClick: () => x("visibility", _t ? "hidden" : "visible"),
											title: _t ? "Hide element" : "Show element",
											"aria-label": _t ? "Hide element" : "Show element",
											children: B(_t ? E : Te, { size: 15 })
										})
									]
								}), /* @__PURE__ */ V("label", {
									className: "vt-select-field vt-full-field vt-parent-picker",
									children: [/* @__PURE__ */ B("span", { children: "Parent" }), /* @__PURE__ */ B("select", {
										value: St,
										onChange: (e) => {
											let t = document.querySelector(e.target.value);
											t && je(t);
										},
										children: xt.map((e) => /* @__PURE__ */ B("option", {
											value: H(e),
											children: Ct(e)
										}, H(e)))
									})]
								})]
							}),
							/* @__PURE__ */ B(Gt, {
								title: "Show on devices",
								...I("visibility"),
								children: /* @__PURE__ */ V("div", {
									className: "vt-visibility-controls",
									role: "group",
									"aria-label": "Element visibility by device",
									children: [
										/* @__PURE__ */ V("button", {
											className: U.desktop ? "active" : "",
											"aria-pressed": U.desktop,
											onClick: () => Et("desktop"),
											title: U.desktop ? "Visible on desktop" : "Hidden on desktop",
											children: [/* @__PURE__ */ B(Ke, { size: 15 }), /* @__PURE__ */ B("span", { children: "Desktop" })]
										}),
										/* @__PURE__ */ V("button", {
											className: U.tablet ? "active" : "",
											"aria-pressed": U.tablet,
											onClick: () => Et("tablet"),
											title: U.tablet ? "Visible on iPad" : "Hidden on iPad",
											children: [/* @__PURE__ */ B(pt, { size: 15 }), /* @__PURE__ */ B("span", { children: "iPad" })]
										}),
										/* @__PURE__ */ V("button", {
											className: U.phone ? "active" : "",
											"aria-pressed": U.phone,
											onClick: () => Et("phone"),
											title: U.phone ? "Visible on phone" : "Hidden on phone",
											children: [/* @__PURE__ */ B(ct, { size: 15 }), /* @__PURE__ */ B("span", { children: "Phone" })]
										})
									]
								})
							}),
							ft ? /* @__PURE__ */ V(Gt, {
								title: "Layout",
								...I("layout"),
								children: [
									/* @__PURE__ */ V("label", {
										className: "vt-select-field vt-full-field",
										children: [/* @__PURE__ */ B("span", { children: "Display" }), /* @__PURE__ */ V("select", {
											value: u.display,
											onChange: (e) => x("display", e.target.value),
											children: [
												/* @__PURE__ */ B("option", {
													value: "block",
													children: "Block"
												}),
												/* @__PURE__ */ B("option", {
													value: "flex",
													children: "Flex"
												}),
												/* @__PURE__ */ B("option", {
													value: "grid",
													children: "Grid"
												}),
												/* @__PURE__ */ B("option", {
													value: "inline-flex",
													children: "Inline flex"
												})
											]
										})]
									}),
									u.display.includes("flex") ? /* @__PURE__ */ V(z, { children: [
										/* @__PURE__ */ V("div", {
											className: "vt-grid-2 vt-layout-row",
											children: [/* @__PURE__ */ V("label", {
												className: "vt-select-field",
												children: [/* @__PURE__ */ B("span", { children: "Flow" }), /* @__PURE__ */ V("select", {
													value: u.flexDirection,
													onChange: (e) => x("flex-direction", e.target.value),
													children: [
														/* @__PURE__ */ B("option", {
															value: "row",
															children: "Row"
														}),
														/* @__PURE__ */ B("option", {
															value: "column",
															children: "Column"
														}),
														/* @__PURE__ */ B("option", {
															value: "row-reverse",
															children: "Row reverse"
														}),
														/* @__PURE__ */ B("option", {
															value: "column-reverse",
															children: "Column reverse"
														})
													]
												})]
											}), /* @__PURE__ */ B(W, {
												label: "Gap",
												value: u.gap,
												onChange: (e) => x("gap", e)
											})]
										}),
										/* @__PURE__ */ V("label", {
											className: "vt-select-field vt-full-field",
											children: [/* @__PURE__ */ B("span", { children: "Across" }), /* @__PURE__ */ V("select", {
												value: u.justifyContent,
												onChange: (e) => x("justify-content", e.target.value),
												children: [
													/* @__PURE__ */ B("option", {
														value: "flex-start",
														children: "Start"
													}),
													/* @__PURE__ */ B("option", {
														value: "center",
														children: "Center"
													}),
													/* @__PURE__ */ B("option", {
														value: "flex-end",
														children: "End"
													}),
													/* @__PURE__ */ B("option", {
														value: "space-between",
														children: "Space between"
													}),
													/* @__PURE__ */ B("option", {
														value: "space-around",
														children: "Space around"
													})
												]
											})]
										}),
										/* @__PURE__ */ V("label", {
											className: "vt-select-field vt-full-field",
											children: [/* @__PURE__ */ B("span", { children: "Cross" }), /* @__PURE__ */ V("select", {
												value: u.alignItems,
												onChange: (e) => x("align-items", e.target.value),
												children: [
													/* @__PURE__ */ B("option", {
														value: "stretch",
														children: "Stretch"
													}),
													/* @__PURE__ */ B("option", {
														value: "flex-start",
														children: "Start"
													}),
													/* @__PURE__ */ B("option", {
														value: "center",
														children: "Center"
													}),
													/* @__PURE__ */ B("option", {
														value: "flex-end",
														children: "End"
													}),
													/* @__PURE__ */ B("option", {
														value: "baseline",
														children: "Baseline"
													})
												]
											})]
										})
									] }) : null,
									u.display === "grid" ? /* @__PURE__ */ V(z, { children: [/* @__PURE__ */ V("label", {
										className: "vt-select-field vt-full-field",
										children: [/* @__PURE__ */ B("span", { children: "Columns" }), /* @__PURE__ */ V("select", {
											value: o.style.gridTemplateColumns || "custom",
											onChange: (e) => e.target.value !== "custom" && x("grid-template-columns", e.target.value),
											children: [
												/* @__PURE__ */ B("option", {
													value: "custom",
													disabled: !0,
													children: "Current"
												}),
												/* @__PURE__ */ B("option", {
													value: "repeat(auto-fit, minmax(220px, 1fr))",
													children: "Responsive"
												}),
												/* @__PURE__ */ B("option", {
													value: "repeat(1, minmax(0, 1fr))",
													children: "1"
												}),
												/* @__PURE__ */ B("option", {
													value: "repeat(2, minmax(0, 1fr))",
													children: "2"
												}),
												/* @__PURE__ */ B("option", {
													value: "repeat(3, minmax(0, 1fr))",
													children: "3"
												}),
												/* @__PURE__ */ B("option", {
													value: "repeat(4, minmax(0, 1fr))",
													children: "4"
												})
											]
										})]
									}), /* @__PURE__ */ B(W, {
										label: "Gap",
										value: u.gap,
										onChange: (e) => x("gap", e)
									})] }) : null
								]
							}) : null,
							/* @__PURE__ */ V(Gt, {
								title: "Position",
								...I("position"),
								children: [
									/* @__PURE__ */ V("div", {
										className: "vt-grid-2",
										children: [/* @__PURE__ */ B(W, {
											label: "X",
											value: u.translateX,
											onChange: (e) => ue(Number.parseFloat(e) || 0, u.translateY)
										}), /* @__PURE__ */ B(W, {
											label: "Y",
											value: u.translateY,
											onChange: (e) => ue(u.translateX, Number.parseFloat(e) || 0)
										})]
									}),
									/* @__PURE__ */ V("div", {
										className: "vt-parent-align",
										role: "group",
										"aria-label": "Align selected element to parent",
										children: [
											/* @__PURE__ */ B("button", {
												onClick: () => de("horizontal", "start"),
												title: "Align left in parent",
												children: /* @__PURE__ */ B(l, { size: 14 })
											}),
											/* @__PURE__ */ B("button", {
												onClick: () => de("horizontal", "center"),
												title: "Center horizontally in parent",
												children: /* @__PURE__ */ B(s, { size: 14 })
											}),
											/* @__PURE__ */ B("button", {
												onClick: () => de("horizontal", "end"),
												title: "Align right in parent",
												children: /* @__PURE__ */ B(c, { size: 14 })
											}),
											/* @__PURE__ */ B("i", {}),
											/* @__PURE__ */ B("button", {
												onClick: () => de("vertical", "start"),
												title: "Align top in parent",
												children: /* @__PURE__ */ B(h, { size: 14 })
											}),
											/* @__PURE__ */ B("button", {
												onClick: () => de("vertical", "center"),
												title: "Center vertically in parent",
												children: /* @__PURE__ */ B(m, { size: 14 })
											}),
											/* @__PURE__ */ B("button", {
												onClick: () => de("vertical", "end"),
												title: "Align bottom in parent",
												children: /* @__PURE__ */ B(ee, { size: 14 })
											})
										]
									}),
									/* @__PURE__ */ V("div", {
										className: "vt-nudge-row",
										children: [/* @__PURE__ */ V("div", {
											className: "vt-direction-pad",
											"aria-label": "Move selected element",
											children: [
												/* @__PURE__ */ B("button", {
													className: "up",
													onClick: () => fe(0, -Ie),
													title: "Move up",
													children: /* @__PURE__ */ B(v, { size: 14 })
												}),
												/* @__PURE__ */ B("button", {
													className: "left",
													onClick: () => fe(-Ie, 0),
													title: "Move left",
													children: /* @__PURE__ */ B(g, { size: 14 })
												}),
												/* @__PURE__ */ B("button", {
													className: "center",
													onClick: () => ue(0, 0),
													title: "Reset position",
													children: /* @__PURE__ */ B(et, { size: 12 })
												}),
												/* @__PURE__ */ B("button", {
													className: "right",
													onClick: () => fe(Ie, 0),
													title: "Move right",
													children: /* @__PURE__ */ B(_, { size: 14 })
												}),
												/* @__PURE__ */ B("button", {
													className: "down",
													onClick: () => fe(0, Ie),
													title: "Move down",
													children: /* @__PURE__ */ B(te, { size: 14 })
												})
											]
										}), /* @__PURE__ */ V("div", {
											className: "vt-step-control",
											"aria-label": "Movement amount",
											children: [/* @__PURE__ */ B("span", { children: "Move by" }), /* @__PURE__ */ B("div", { children: [
												1,
												5,
												10
											].map((e) => /* @__PURE__ */ V("button", {
												className: Ie === e ? "active" : "",
												onClick: () => Le(e),
												children: [e, "px"]
											}, e)) })]
										})]
									})
								]
							}),
							/* @__PURE__ */ V(Gt, {
								title: "Size",
								...I("size"),
								children: [/* @__PURE__ */ V("div", {
									className: "vt-grid-2",
									children: [/* @__PURE__ */ B(W, {
										label: "W",
										value: u.width,
										onChange: (e) => w("width", e)
									}), /* @__PURE__ */ B(W, {
										label: "H",
										value: u.height,
										onChange: (e) => w("height", e)
									})]
								}), /* @__PURE__ */ V("div", {
									className: "vt-quick-actions",
									children: [
										/* @__PURE__ */ V("button", {
											onClick: () => pe(.9),
											children: [/* @__PURE__ */ B(M, { size: 13 }), "10%"]
										}),
										/* @__PURE__ */ V("button", {
											onClick: () => pe(1.1),
											children: [/* @__PURE__ */ B(Ze, { size: 13 }), "10%"]
										}),
										/* @__PURE__ */ V("button", {
											onClick: me,
											children: [/* @__PURE__ */ B(A, { size: 13 }), "Fill width"]
										}),
										/* @__PURE__ */ V("button", {
											className: ae ? "active" : "",
											"aria-pressed": ae,
											onClick: () => oe(!ae),
											title: ae ? "Unlock aspect ratio" : "Lock aspect ratio",
											children: [B(ae ? Ue : R, { size: 13 }), "Ratio"]
										})
									]
								})]
							}),
							/* @__PURE__ */ V(Gt, {
								title: "Spacing",
								...I("spacing"),
								children: [/* @__PURE__ */ V("div", {
									className: "vt-box-model",
									children: [
										/* @__PURE__ */ B(W, {
											label: "MT",
											value: u.marginTop,
											onChange: (e) => x("margin-top", e)
										}),
										/* @__PURE__ */ B(W, {
											label: "MR",
											value: u.marginRight,
											onChange: (e) => x("margin-right", e)
										}),
										/* @__PURE__ */ B(W, {
											label: "MB",
											value: u.marginBottom,
											onChange: (e) => x("margin-bottom", e)
										}),
										/* @__PURE__ */ B(W, {
											label: "ML",
											value: u.marginLeft,
											onChange: (e) => x("margin-left", e)
										})
									]
								}), /* @__PURE__ */ V("div", {
									className: "vt-box-model vt-box-model-padding",
									children: [
										/* @__PURE__ */ B(W, {
											label: "PT",
											value: u.paddingTop,
											onChange: (e) => x("padding-top", e)
										}),
										/* @__PURE__ */ B(W, {
											label: "PR",
											value: u.paddingRight,
											onChange: (e) => x("padding-right", e)
										}),
										/* @__PURE__ */ B(W, {
											label: "PB",
											value: u.paddingBottom,
											onChange: (e) => x("padding-bottom", e)
										}),
										/* @__PURE__ */ B(W, {
											label: "PL",
											value: u.paddingLeft,
											onChange: (e) => x("padding-left", e)
										})
									]
								})]
							}),
							/* @__PURE__ */ V(Gt, {
								title: "Typography",
								...I("typography"),
								children: [
									/* @__PURE__ */ V("label", {
										className: "vt-select-field vt-full-field",
										children: [/* @__PURE__ */ B("span", { children: "Font" }), /* @__PURE__ */ V("select", {
											value: vt,
											onChange: (e) => e.target.value !== "current" && x("font-family", e.target.value),
											children: [/* @__PURE__ */ V("option", {
												value: "current",
												disabled: !0,
												children: ["Current: ", u.fontFamily.split(",")[0].replaceAll("\"", "")]
											}), Kt.map(([e, t]) => /* @__PURE__ */ B("option", {
												value: t,
												children: e
											}, t))]
										})]
									}),
									/* @__PURE__ */ V("div", {
										className: "vt-grid-2",
										children: [/* @__PURE__ */ B(W, {
											label: "Size",
											value: u.fontSize,
											onChange: (e) => x("font-size", e)
										}), /* @__PURE__ */ V("label", {
											className: "vt-select-field",
											children: [/* @__PURE__ */ B("span", { children: "Align" }), /* @__PURE__ */ V("select", {
												value: u.textAlign,
												onChange: (e) => x("text-align", e.target.value),
												children: [
													/* @__PURE__ */ B("option", { children: "left" }),
													/* @__PURE__ */ B("option", { children: "center" }),
													/* @__PURE__ */ B("option", { children: "right" })
												]
											})]
										})]
									}),
									/* @__PURE__ */ V("div", {
										className: "vt-grid-2 vt-layout-row",
										children: [/* @__PURE__ */ V("label", {
											className: "vt-select-field",
											children: [/* @__PURE__ */ B("span", { children: "Weight" }), /* @__PURE__ */ V("select", {
												value: u.fontWeight,
												onChange: (e) => x("font-weight", e.target.value),
												children: [
													/* @__PURE__ */ B("option", {
														value: "300",
														children: "Light"
													}),
													/* @__PURE__ */ B("option", {
														value: "400",
														children: "Regular"
													}),
													/* @__PURE__ */ B("option", {
														value: "500",
														children: "Medium"
													}),
													/* @__PURE__ */ B("option", {
														value: "600",
														children: "Semibold"
													}),
													/* @__PURE__ */ B("option", {
														value: "700",
														children: "Bold"
													}),
													/* @__PURE__ */ B("option", {
														value: "800",
														children: "Heavy"
													})
												]
											})]
										}), /* @__PURE__ */ B(W, {
											label: "Tracking",
											value: u.letterSpacing,
											onChange: (e) => x("letter-spacing", e)
										})]
									}),
									/* @__PURE__ */ V("div", {
										className: "vt-slider-row",
										children: [
											/* @__PURE__ */ B("button", {
												onClick: () => x("font-size", `${Math.max(8, Math.round(u.fontSize) - 1)}px`),
												title: "Decrease font size",
												children: /* @__PURE__ */ B(M, { size: 13 })
											}),
											/* @__PURE__ */ B("input", {
												"aria-label": "Font size",
												type: "range",
												min: "8",
												max: "120",
												step: "1",
												value: Math.min(120, Math.max(8, u.fontSize)),
												onChange: (e) => x("font-size", `${e.target.value}px`)
											}),
											/* @__PURE__ */ B("button", {
												onClick: () => x("font-size", `${Math.min(120, Math.round(u.fontSize) + 1)}px`),
												title: "Increase font size",
												children: /* @__PURE__ */ B(Ze, { size: 13 })
											})
										]
									}),
									/* @__PURE__ */ V("div", {
										className: "vt-line-height-control",
										children: [
											/* @__PURE__ */ B("span", { children: "Line height" }),
											/* @__PURE__ */ B("input", {
												"aria-label": "Line height",
												type: "range",
												min: "0.8",
												max: "2",
												step: "0.05",
												value: Math.min(2, Math.max(.8, u.lineHeight)),
												onChange: (e) => x("line-height", e.target.value)
											}),
											/* @__PURE__ */ B("code", { children: u.lineHeight.toFixed(2) })
										]
									}),
									/* @__PURE__ */ V("label", {
										className: "vt-color-field",
										children: [
											/* @__PURE__ */ B("span", { children: "Text" }),
											/* @__PURE__ */ B("input", {
												type: "color",
												value: rn(u.color),
												onChange: (e) => x("color", e.target.value)
											}),
											/* @__PURE__ */ B("code", { children: rn(u.color) })
										]
									})
								]
							}),
							dt ? /* @__PURE__ */ V(Gt, {
								title: "Link",
								...I("link"),
								children: [/* @__PURE__ */ B(Zt, {
									label: "Destination",
									value: o.getAttribute("href") ?? "",
									placeholder: "https:// or #section",
									onCommit: (e) => le("href", e)
								}, `${o.dataset.vtLabel}-href`), /* @__PURE__ */ V("label", {
									className: "vt-toggle-field",
									children: [
										/* @__PURE__ */ B("span", { children: "Open in new tab" }),
										/* @__PURE__ */ B("input", {
											type: "checkbox",
											checked: o.getAttribute("target") === "_blank",
											onChange: (e) => le("target", e.target.checked ? "_blank" : "")
										}),
										/* @__PURE__ */ B("i", {})
									]
								})]
							}) : null,
							lt ? /* @__PURE__ */ V(Gt, {
								title: ut ? "Image" : "Media",
								...I("media"),
								children: [
									/* @__PURE__ */ B(Zt, {
										label: "Source",
										value: o.getAttribute("src") ?? "",
										placeholder: "https://example.com/image.jpg",
										onCommit: (e) => le("src", e)
									}, `${o.dataset.vtLabel}-src`),
									ut ? /* @__PURE__ */ V(z, { children: [
										/* @__PURE__ */ B(Zt, {
											label: "Alt text",
											value: o.getAttribute("alt") ?? "",
											placeholder: "Describe the image",
											onCommit: (e) => le("alt", e)
										}, `${o.dataset.vtLabel}-alt`),
										/* @__PURE__ */ B("input", {
											ref: qe,
											className: "vt-file-input",
											type: "file",
											accept: "image/*",
											onChange: (e) => {
												Dt(e.target.files?.[0]), e.currentTarget.value = "";
											}
										}),
										/* @__PURE__ */ V("button", {
											className: "vt-media-upload",
											onClick: () => qe.current?.click(),
											children: [/* @__PURE__ */ B(Fe, { size: 14 }), "Replace from computer"]
										}),
										ze ? /* @__PURE__ */ B("p", {
											className: "vt-media-error",
											children: ze
										}) : null
									] }) : null,
									/* @__PURE__ */ V("label", {
										className: "vt-select-field vt-full-field",
										children: [/* @__PURE__ */ B("span", { children: "Fit" }), /* @__PURE__ */ V("select", {
											value: u.objectFit,
											onChange: (e) => x("object-fit", e.target.value),
											children: [
												/* @__PURE__ */ B("option", {
													value: "cover",
													children: "Cover"
												}),
												/* @__PURE__ */ B("option", {
													value: "contain",
													children: "Contain"
												}),
												/* @__PURE__ */ B("option", {
													value: "fill",
													children: "Stretch"
												}),
												/* @__PURE__ */ B("option", {
													value: "none",
													children: "Original"
												})
											]
										})]
									}),
									/* @__PURE__ */ B(tn, {
										value: u.objectPosition,
										onChange: (e) => x("object-position", e)
									})
								]
							}) : null,
							!lt && (ft || u.backgroundImage !== "none") ? /* @__PURE__ */ V(Gt, {
								title: "Background image",
								...I("background"),
								children: [
									/* @__PURE__ */ B(Zt, {
										label: "Source",
										value: bt.startsWith("data:") ? "" : bt,
										placeholder: bt.startsWith("data:") ? "Local image saved in this session" : "https://example.com/hero.jpg",
										onCommit: (e) => x("background-image", e ? `url("${e.replaceAll("\"", "")}")` : "none")
									}),
									/* @__PURE__ */ B("input", {
										ref: Je,
										className: "vt-file-input",
										type: "file",
										accept: "image/*",
										onChange: (e) => {
											Ot(e.target.files?.[0]), e.currentTarget.value = "";
										}
									}),
									/* @__PURE__ */ V("div", {
										className: "vt-background-actions",
										children: [/* @__PURE__ */ V("button", {
											className: "vt-media-upload",
											onClick: () => Je.current?.click(),
											children: [/* @__PURE__ */ B(Fe, { size: 14 }), "Replace from computer"]
										}), /* @__PURE__ */ B("button", {
											onClick: () => S("background-image", "none", "Remove background image"),
											title: "Remove background image",
											children: /* @__PURE__ */ B(mt, { size: 13 })
										})]
									}),
									Ve ? /* @__PURE__ */ B("p", {
										className: "vt-media-error",
										children: Ve
									}) : null,
									/* @__PURE__ */ V("div", {
										className: "vt-grid-2 vt-layout-row",
										children: [/* @__PURE__ */ V("label", {
											className: "vt-select-field",
											children: [/* @__PURE__ */ B("span", { children: "Fit" }), /* @__PURE__ */ V("select", {
												value: u.backgroundSize,
												onChange: (e) => x("background-size", e.target.value),
												children: [
													/* @__PURE__ */ B("option", {
														value: "cover",
														children: "Cover"
													}),
													/* @__PURE__ */ B("option", {
														value: "contain",
														children: "Contain"
													}),
													/* @__PURE__ */ B("option", {
														value: "auto",
														children: "Original"
													}),
													/* @__PURE__ */ B("option", {
														value: "100% 100%",
														children: "Stretch"
													})
												]
											})]
										}), /* @__PURE__ */ V("label", {
											className: "vt-select-field",
											children: [/* @__PURE__ */ B("span", { children: "Repeat" }), /* @__PURE__ */ V("select", {
												value: u.backgroundRepeat,
												onChange: (e) => x("background-repeat", e.target.value),
												children: [
													/* @__PURE__ */ B("option", {
														value: "no-repeat",
														children: "None"
													}),
													/* @__PURE__ */ B("option", {
														value: "repeat",
														children: "Tile"
													}),
													/* @__PURE__ */ B("option", {
														value: "repeat-x",
														children: "Across"
													}),
													/* @__PURE__ */ B("option", {
														value: "repeat-y",
														children: "Down"
													})
												]
											})]
										})]
									}),
									/* @__PURE__ */ B(tn, {
										value: u.backgroundPosition,
										onChange: (e) => x("background-position", e)
									})
								]
							}) : null,
							/* @__PURE__ */ V(Gt, {
								title: "Appearance",
								...I("appearance"),
								children: [
									/* @__PURE__ */ V("label", {
										className: "vt-color-field",
										children: [
											/* @__PURE__ */ B("span", { children: "Fill" }),
											/* @__PURE__ */ B("input", {
												type: "color",
												value: rn(u.backgroundColor),
												onChange: (e) => x("background-color", e.target.value)
											}),
											/* @__PURE__ */ B("code", { children: u.backgroundColor === "transparent" || u.backgroundColor.endsWith(", 0)") ? "clear" : rn(u.backgroundColor) }),
											/* @__PURE__ */ B("button", {
												type: "button",
												onClick: () => x("background-color", "transparent"),
												title: "Clear fill",
												children: /* @__PURE__ */ B(Ce, { size: 12 })
											})
										]
									}),
									/* @__PURE__ */ V("div", {
										className: "vt-grid-2",
										children: [/* @__PURE__ */ B(W, {
											label: "Radius",
											value: u.borderRadius,
											onChange: (e) => x("border-radius", e)
										}), /* @__PURE__ */ B(W, {
											label: "Opacity",
											value: u.opacity * 100,
											suffix: "%",
											onChange: (e) => x("opacity", String(Number.parseInt(e) / 100))
										})]
									}),
									/* @__PURE__ */ V("div", {
										className: "vt-grid-2 vt-layout-row",
										children: [/* @__PURE__ */ B(W, {
											label: "Border",
											value: u.borderWidth,
											onChange: (e) => {
												u.borderStyle === "none" && x("border-style", "solid"), x("border-width", e);
											}
										}), /* @__PURE__ */ V("label", {
											className: "vt-select-field",
											children: [/* @__PURE__ */ B("span", { children: "Style" }), /* @__PURE__ */ V("select", {
												value: u.borderStyle,
												onChange: (e) => x("border-style", e.target.value),
												children: [
													/* @__PURE__ */ B("option", {
														value: "none",
														children: "None"
													}),
													/* @__PURE__ */ B("option", {
														value: "solid",
														children: "Solid"
													}),
													/* @__PURE__ */ B("option", {
														value: "dashed",
														children: "Dashed"
													}),
													/* @__PURE__ */ B("option", {
														value: "dotted",
														children: "Dotted"
													})
												]
											})]
										})]
									}),
									/* @__PURE__ */ V("label", {
										className: "vt-color-field vt-border-color",
										children: [
											/* @__PURE__ */ B("span", { children: "Border" }),
											/* @__PURE__ */ B("input", {
												type: "color",
												value: rn(u.borderColor),
												onChange: (e) => x("border-color", e.target.value)
											}),
											/* @__PURE__ */ B("code", { children: rn(u.borderColor) })
										]
									}),
									/* @__PURE__ */ V("label", {
										className: "vt-select-field vt-full-field",
										children: [/* @__PURE__ */ B("span", { children: "Shadow" }), /* @__PURE__ */ V("select", {
											value: yt,
											onChange: (e) => e.target.value !== "current" && x("box-shadow", e.target.value),
											children: [/* @__PURE__ */ B("option", {
												value: "current",
												disabled: !0,
												children: "Current"
											}), qt.map(([e, t]) => /* @__PURE__ */ B("option", {
												value: t,
												children: e
											}, t))]
										})]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ V("button", {
						className: "vt-reset",
						onClick: ve,
						children: [/* @__PURE__ */ B(et, { size: 14 }), " Reset this element"]
					})
				]
			}) : /* @__PURE__ */ V("div", {
				className: "vt-empty",
				children: [/* @__PURE__ */ B("p", { children: "Select anything on the page to edit it." }), /* @__PURE__ */ B("span", { children: "Click text, images, buttons, or containers." })]
			}) : /* @__PURE__ */ V("div", {
				className: "vt-changes-panel",
				children: [
					/* @__PURE__ */ V("label", {
						className: "vt-note-field",
						children: [/* @__PURE__ */ B("span", { children: "Tell Codex what you want" }), /* @__PURE__ */ B("textarea", {
							value: y,
							onChange: (e) => Ee(e.target.value),
							placeholder: "Example: Keep this centered on phone, but move it down on desktop."
						})]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-changes-actions",
						children: [/* @__PURE__ */ V("button", {
							className: "vt-copy",
							onClick: he,
							children: [B(p ? ie : it, { size: 15 }), p ? "Ready in Codex" : "Send to Codex"]
						}), /* @__PURE__ */ B("button", {
							className: "vt-icon-button",
							onClick: ye,
							title: "Clear all changes",
							children: /* @__PURE__ */ B(mt, { size: 15 })
						})]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-versions",
						children: [
							/* @__PURE__ */ B("header", { children: /* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B(C, { size: 13 }), /* @__PURE__ */ B("strong", { children: "Saved versions" })] }) }),
							/* @__PURE__ */ V("div", {
								className: "vt-version-create",
								children: [/* @__PURE__ */ B("input", {
									value: k,
									onChange: (e) => He(e.target.value),
									onKeyDown: (e) => {
										e.key === "Enter" && d.length && kt();
									},
									placeholder: "Name this visual state"
								}), /* @__PURE__ */ V("button", {
									onClick: kt,
									disabled: !d.length,
									children: [/* @__PURE__ */ B(tt, { size: 13 }), "Save"]
								})]
							}),
							f.length ? /* @__PURE__ */ B("ol", { children: [...f].reverse().map((e) => /* @__PURE__ */ V("li", { children: [/* @__PURE__ */ V("button", {
								className: "vt-version-restore",
								onClick: () => Se(e),
								children: [/* @__PURE__ */ B("strong", { children: e.name }), /* @__PURE__ */ V("span", { children: [
									new Date(e.timestamp).toLocaleString([], {
										month: "short",
										day: "numeric",
										hour: "numeric",
										minute: "2-digit"
									}),
									" · ",
									e.changes.length,
									" edits"
								] })]
							}), /* @__PURE__ */ B("button", {
								className: "vt-version-delete",
								onClick: () => we(e.id),
								title: "Delete saved version",
								children: /* @__PURE__ */ B(mt, { size: 12 })
							})] }, e.id)) }) : /* @__PURE__ */ B("p", { children: "Save a good visual state before experimenting." })
						]
					}),
					ot.length ? /* @__PURE__ */ B("ol", {
						className: "vt-change-list",
						children: ot.map((e) => /* @__PURE__ */ V("li", { children: [/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: e.label }), /* @__PURE__ */ B("code", { children: e.device ? `${e.device}:${e.property}` : e.property })] }), /* @__PURE__ */ V("div", {
							className: "vt-change-value",
							children: [/* @__PURE__ */ B("span", { children: e.value }), /* @__PURE__ */ B("button", {
								onClick: () => be(e),
								title: `Revert ${e.property}`,
								children: /* @__PURE__ */ B(et, { size: 12 })
							})]
						})] }, e.id))
					}) : /* @__PURE__ */ V("div", {
						className: "vt-empty",
						children: [/* @__PURE__ */ B("p", { children: "No changes yet." }), /* @__PURE__ */ B("span", { children: "Move or resize something and it will appear here." })]
					})
				]
			})
		]
	});
}
function rn(e) {
	if (e === "transparent" || e.startsWith("rgba") && e.endsWith(", 0)")) return "#ffffff";
	let t = e.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
	return !t || t.length < 3 ? e.startsWith("#") ? e : "#ffffff" : `#${t.map((e) => Math.round(e).toString(16).padStart(2, "0")).join("")}`;
}
//#endregion
//#region src/visual-truth/LayersPanel.tsx
var an = 220, on = (e) => Math.min(360, Math.max(180, e)), sn = () => `visual-truth:layers-preferences:v2:${window.location.pathname}`, cn = [
	{
		value: "all",
		label: "All elements"
	},
	{
		value: "text",
		label: "Text"
	},
	{
		value: "media",
		label: "Media"
	},
	{
		value: "layout",
		label: "Layout"
	},
	{
		value: "controls",
		label: "Controls"
	}
], ln = (e) => cn.some((t) => t.value === e), un = () => {
	if (typeof window > "u") return {
		detailed: !1,
		collapsed: [],
		filter: "all"
	};
	try {
		let e = JSON.parse(window.localStorage.getItem(sn()) || "{}");
		return {
			detailed: e.detailed === !0,
			collapsed: Array.isArray(e.collapsed) ? e.collapsed.filter((e) => typeof e == "string") : [],
			filter: ln(e.filter) ? e.filter : "all"
		};
	} catch {
		return {
			detailed: !1,
			collapsed: [],
			filter: "all"
		};
	}
};
function dn({ selected: e, onSelect: n, onReorder: a, revision: o, width: s, onWidthChange: c }) {
	let [l] = i(un), [u, d] = i(""), [f, p] = i(l.detailed), [m, ee] = i(() => new Set(l.collapsed)), [h, te] = i(l.filter), [g, _] = i(!1), [v, y] = i(null), [b, ne] = i(null), re = r(null), ie = `[data-vt-label], main, header, footer, nav, section, article, aside, h1, h2, h3, h4, h5, h6, p, a, button, label, li, blockquote, figure, figcaption, img, picture, video, canvas, [role="img"], form, ul, ol, input, textarea, select, [role="button"]${f ? ", div, span" : ""}`, ae = [...document.querySelectorAll(ie)].filter((e) => !e.closest("[data-visual-truth-ui]")).filter((e) => {
		let t = e.getBoundingClientRect();
		return t.width > 0 && t.height > 0;
	}).slice(0, 350), oe = new Set(ae), se = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
	for (let e of ae) {
		let t = e.parentElement;
		for (; t && !oe.has(t);) t = t.parentElement;
		let n = t && oe.has(t) ? t : null;
		se.set(e, n), n && x.set(n, (x.get(n) || 0) + 1);
	}
	let le = ae.filter((e) => x.has(e)).map(pn), ue = new Set(le), de = u.trim().toLowerCase(), C = g ? "all" : h, w = (e) => C === "all" ? !0 : C === "text" ? e.matches("h1, h2, h3, h4, h5, h6, p, span, label, li, blockquote, figcaption") : C === "media" ? e.matches("figure, img, picture, video, svg, canvas, [role=\"img\"]") || getComputedStyle(e).backgroundImage !== "none" || /image|photo|media|video|logo|graphic|illustration|artwork/i.test(e.dataset.vtLabel || "") : C === "layout" ? e.matches("main, header, footer, nav, section, article, aside, div, form, ul, ol") : e.matches("a, button, input, textarea, select, [role=\"button\"]"), fe = (t) => !g || !e || t === e || t.contains(e) || e.contains(t), pe = (e) => {
		let t = se.get(e) || null;
		for (; t;) {
			if (m.has(pn(t))) return !0;
			t = se.get(t) || null;
		}
		return !1;
	}, me = ae.filter((e) => w(e) ? de ? `${Ct(e)} ${e.tagName}`.toLowerCase().includes(de) : fe(e) && !pe(e) : !1), T = le.some((e) => m.has(e)), he = (e) => {
		let t = pn(e);
		ee((e) => {
			let n = new Set(e);
			return n.has(t) ? n.delete(t) : n.add(t), n;
		});
	};
	return t(() => {
		try {
			window.localStorage.setItem(sn(), JSON.stringify({
				detailed: f,
				collapsed: [...m],
				filter: h
			}));
		} catch {}
	}, [
		f,
		m,
		h
	]), t(() => {
		let e = window.requestAnimationFrame(() => re.current?.scrollIntoView({ block: "nearest" }));
		return () => window.cancelAnimationFrame(e);
	}, [
		e,
		f,
		g,
		u,
		m
	]), /* @__PURE__ */ V("aside", {
		className: "vt-layers",
		"data-visual-truth-ui": !0,
		children: [
			/* @__PURE__ */ B("button", {
				className: "vt-layers-resize-handle",
				"aria-label": "Resize Layers panel",
				title: "Drag to resize. Double-click to reset.",
				onPointerDown: (e) => {
					e.preventDefault(), e.stopPropagation();
					let t = e.clientX, n = s, r = (e) => c(on(n + e.clientX - t)), i = () => {
						window.removeEventListener("pointermove", r), window.removeEventListener("pointerup", i), window.removeEventListener("pointercancel", i), document.body.classList.remove("vt-resizing-layers");
					};
					document.body.classList.add("vt-resizing-layers"), window.addEventListener("pointermove", r), window.addEventListener("pointerup", i), window.addEventListener("pointercancel", i);
				},
				onDoubleClick: () => c(an),
				children: /* @__PURE__ */ B(Ae, { size: 12 })
			}),
			/* @__PURE__ */ V("header", { children: [
				/* @__PURE__ */ B(Le, { size: 16 }),
				/* @__PURE__ */ B("strong", { children: "Layers" }),
				/* @__PURE__ */ B("button", {
					className: g ? "active" : "",
					"aria-label": "Focus selected hierarchy",
					"aria-pressed": g,
					disabled: !e,
					onClick: () => _((e) => !e),
					title: e ? g ? "Show complete page hierarchy" : "Show only the selected hierarchy" : "Select an element to focus its hierarchy",
					children: /* @__PURE__ */ B(De, { size: 14 })
				}),
				/* @__PURE__ */ B("button", {
					"data-collapsed-count": m.size,
					"aria-label": T ? "Expand all layer branches" : "Collapse all layer branches",
					onClick: () => ee(T ? /* @__PURE__ */ new Set() : new Set(le)),
					title: T ? "Expand all layer branches" : "Collapse all layer branches",
					children: /* @__PURE__ */ B(S, { size: 14 })
				}),
				/* @__PURE__ */ B("button", {
					className: f ? "active" : "",
					"aria-label": f ? "Show essential layers" : "Show all containers",
					"aria-pressed": f,
					onClick: () => p((e) => !e),
					title: f ? "Show essential layers" : "Show all containers",
					children: /* @__PURE__ */ B(k, { size: 14 })
				})
			] }),
			/* @__PURE__ */ V("label", {
				className: "vt-layer-search",
				children: [/* @__PURE__ */ B(rt, { size: 13 }), /* @__PURE__ */ B("input", {
					value: u,
					onChange: (e) => d(e.target.value),
					placeholder: "Search page layers"
				})]
			}),
			/* @__PURE__ */ V("div", {
				className: "vt-layer-filter-row",
				children: [/* @__PURE__ */ B("select", {
					"aria-label": "Filter layer types",
					value: h,
					disabled: g,
					onChange: (e) => te(e.target.value),
					title: g ? "Turn off Focus Selection to filter layer types" : "Show only one kind of layer",
					children: cn.map((e) => /* @__PURE__ */ B("option", {
						value: e.value,
						children: e.label
					}, e.value))
				}), /* @__PURE__ */ V("output", {
					"aria-live": "polite",
					title: `Showing ${me.length} of ${ae.length} page layers`,
					children: [
						me.length,
						" / ",
						ae.length
					]
				})]
			}),
			/* @__PURE__ */ V("div", {
				className: "vt-layer-list",
				children: [me.map((t) => {
					let r = Math.min(3, fn(t)), i = Ct(t), o = ue.has(pn(t)), s = o && m.has(pn(t)), c = b?.element === t ? `drop-${b.placement}` : "";
					return /* @__PURE__ */ V("button", {
						ref: e === t ? re : void 0,
						className: `${e === t ? "selected" : ""} ${v === t ? "dragging" : ""} ${c}`,
						style: { paddingLeft: 12 + r * 12 },
						onClick: (e) => {
							o && e.target.closest(".vt-layer-chevron") ? he(t) : n(t);
						},
						onKeyDown: (e) => {
							o && (e.key === "ArrowLeft" && !s && (e.preventDefault(), he(t)), e.key === "ArrowRight" && s && (e.preventDefault(), he(t)));
						},
						"aria-expanded": o ? !s : void 0,
						title: o ? `${i}. Use the chevron to ${s ? "expand" : "collapse"}.` : i,
						draggable: !!(t.parentElement && t.parentElement !== document.body && t.tagName !== "MAIN"),
						onDragStart: (e) => {
							y(t), e.dataTransfer.effectAllowed = "move";
						},
						onDragOver: (e) => {
							if (!v || v === t || v.contains(t)) return;
							e.preventDefault(), e.dataTransfer.dropEffect = "move";
							let n = e.currentTarget.getBoundingClientRect(), r = (e.clientY - n.top) / n.height, i = t.matches("main, section, article, header, footer, nav, aside, div, form, ul, ol");
							ne({
								element: t,
								placement: r < .28 ? "before" : r > .72 ? "after" : i ? "inside" : r < .5 ? "before" : "after"
							});
						},
						onDrop: (e) => {
							e.preventDefault(), v && b?.element === t && a(v, t, b.placement), y(null), ne(null);
						},
						onDragEnd: () => {
							y(null), ne(null);
						},
						children: [
							/* @__PURE__ */ B("span", {
								className: `vt-layer-chevron${o ? " branch" : ""}${s ? "" : " expanded"}`,
								"aria-hidden": "true",
								children: /* @__PURE__ */ B(ce, { size: 12 })
							}),
							/* @__PURE__ */ B("span", { children: i }),
							t.getAttribute("data-vt-locked") === "true" ? /* @__PURE__ */ B(Ue, {
								className: "vt-layer-state",
								size: 11,
								"aria-label": "Locked"
							}) : null,
							getComputedStyle(t).visibility === "hidden" ? /* @__PURE__ */ B(Te, {
								className: "vt-layer-state",
								size: 11,
								"aria-label": "Hidden"
							}) : null,
							/* @__PURE__ */ B("code", { children: t.tagName.toLowerCase() })
						]
					}, H(t));
				}), me.length ? null : /* @__PURE__ */ B("div", {
					className: "vt-layer-empty",
					children: h === "all" ? "No matching page layers" : `No matching ${cn.find((e) => e.value === h)?.label.toLowerCase()} layers`
				})]
			})
		]
	});
}
function fn(e) {
	let t = 0, n = e.parentElement;
	for (; n && n !== document.body;) t += 1, n = n.parentElement;
	return t;
}
function pn(e) {
	if (e.id) return `#${e.id}`;
	if (e.dataset.vtLabel) return `[data-vt-label="${e.dataset.vtLabel}"]`;
	let t = [], n = e;
	for (; n && n !== document.body;) {
		let e = mn(n), r = n.parentElement;
		if (r) {
			let i = [...r.children].filter((t) => t instanceof HTMLElement && mn(t) === e);
			i.length > 1 ? t.unshift(`${e}:nth(${i.indexOf(n) + 1})`) : t.unshift(e);
		} else t.unshift(e);
		n = r;
	}
	return t.join(">");
}
function mn(e) {
	let t = [...e.classList].filter((e) => !e.startsWith("vt-") && !/^(active|current|selected|open|closed|hidden|loading|loaded|error|success|is-|has-)/.test(e)).sort().slice(0, 2);
	return `${e.tagName.toLowerCase()}${t.length ? `.${t.join(".")}` : ""}`;
}
//#endregion
//#region src/visual-truth/previewDevices.ts
var hn = {
	desktop: {
		label: "Desktop",
		width: 1440,
		height: 900,
		icon: Ke
	},
	tablet: {
		label: "iPad",
		width: 1024,
		height: 1366,
		icon: pt
	},
	phone: {
		label: "Phone",
		width: 440,
		height: 956,
		icon: ct
	}
};
//#endregion
//#region src/visual-truth/previewSync.ts
function gn(e, t) {
	if (e) {
		for (let n of t) {
			if (n.kind === "responsive-style") continue;
			if (n.kind === "style" || n.kind === "text" || n.kind === "attribute") {
				let t = e.querySelector(n.selector);
				if (!t) continue;
				if (n.kind === "text") t.innerText = n.value;
				else if (n.kind === "attribute") {
					let e = n.property.slice(10), r = n.runtimeValue ?? n.value;
					r ? t.setAttribute(e, r) : t.removeAttribute(e);
				} else t.style.setProperty(n.property, n.runtimeValue ?? n.value);
				continue;
			}
			let t = n.parentSelector ? e.querySelector(n.parentSelector) : null;
			if (!t) continue;
			if (n.kind === "insert") {
				!e.querySelector(n.selector) && n.html && yn(e, t, n.html, n.index ?? t.children.length);
				continue;
			}
			let r = e.querySelector(n.previousSelector ?? n.selector) ?? e.querySelector(n.selector);
			if (r && n.stableId && !r.dataset.vtId && (r.dataset.vtId = n.stableId), n.kind === "remove") {
				r?.remove();
				continue;
			}
			r && bn(t, r, n.index ?? 0);
		}
		_n(e, t);
	}
}
function _n(e, t) {
	if (!e) return;
	let n = "visual-truth-responsive-overrides", r = /* @__PURE__ */ new Map();
	for (let e of t) e.kind === "responsive-style" && e.device && r.set(`${e.device}:${e.selector}:${e.property}`, e);
	if (!r.size) {
		e.getElementById(n)?.remove();
		return;
	}
	let i = {
		desktop: [],
		tablet: [],
		phone: []
	};
	for (let e of r.values()) e.device && i[e.device].push(`${e.selector} { ${e.property}: ${e.runtimeValue ?? e.value} !important; }`);
	let a = e.getElementById(n) ?? e.createElement("style");
	a.id = n, a.textContent = [
		i.desktop.length ? `@media (min-width: 1101px) { ${i.desktop.join(" ")} }` : "",
		i.tablet.length ? `@media (min-width: 681px) and (max-width: 1100px) { ${i.tablet.join(" ")} }` : "",
		i.phone.length ? `@media (max-width: 680px) { ${i.phone.join(" ")} }` : ""
	].filter(Boolean).join("\n"), a.isConnected || e.head.append(a);
}
function vn(e, t) {
	let n = e.contentWindow;
	if (!n) return;
	let r = 0, i = () => {
		gn(e.contentDocument, t), r += 1, r < 6 && n.requestAnimationFrame(i);
	};
	i();
}
function yn(e, t, n, r) {
	let i = e.createElement("template");
	i.innerHTML = n.trim();
	let a = i.content.firstElementChild;
	if (!a) return null;
	let o = a;
	return t.insertBefore(o, t.children.item(r) ?? null), o;
}
function bn(e, t, n) {
	let r = [...e.children].filter((e) => e !== t), i = Math.max(0, Math.min(n, r.length));
	e.insertBefore(t, r[i] ?? null);
}
//#endregion
//#region src/visual-truth/ResponsivePreview.tsx
function xn() {
	let e = new URL(window.location.href);
	return e.searchParams.delete("open"), e.searchParams.set("vt-preview-frame", "1"), e.toString();
}
function Sn() {
	let [e, n] = i(() => ({
		width: window.innerWidth,
		height: window.innerHeight
	}));
	return t(() => {
		let e = () => n({
			width: window.innerWidth,
			height: window.innerHeight
		});
		return window.addEventListener("resize", e), () => window.removeEventListener("resize", e);
	}, []), e;
}
function Cn({ device: n, scale: a, src: o, changes: s, selectedSelector: c, selectedLabel: l, onMeasurement: u, compact: d = !1 }) {
	let f = hn[n], p = Math.round(f.width * a), m = Math.round(f.height * a), ee = r(null), [h, te] = i(null), g = e((e) => {
		e && (vn(e, s), e.contentWindow?.postMessage({
			type: "visual-truth:preview-sync",
			frameId: n,
			changes: s,
			selectedSelector: c
		}, "*"));
	}, [
		s,
		c,
		n
	]);
	return t(() => {
		g(ee.current);
	}, [g]), t(() => {
		let e = (e) => {
			if (e.source === ee.current?.contentWindow) {
				if (e.data?.type === "visual-truth:preview-ready") {
					g(ee.current);
					return;
				}
				if (e.data?.type === "visual-truth:preview-measurement" && e.data?.frameId === n) {
					let t = e.data.measurement ?? null;
					te(t), u(n, t);
				}
			}
		};
		return window.addEventListener("message", e), () => window.removeEventListener("message", e);
	}, [
		n,
		g,
		u
	]), /* @__PURE__ */ V("article", {
		className: `vt-preview-device vt-preview-device-${n}`,
		children: [/* @__PURE__ */ V("header", {
			style: { width: p + (d ? 14 : 22) },
			children: [
				/* @__PURE__ */ B("strong", { children: f.label }),
				/* @__PURE__ */ V("code", { children: [
					f.width,
					" × ",
					f.height
				] }),
				/* @__PURE__ */ B("span", { children: "exact CSS viewport" }),
				h ? /* @__PURE__ */ V("small", {
					title: `${l} at X ${h.x}, Y ${h.y}`,
					children: [
						l,
						" · ",
						h.width,
						" × ",
						h.height,
						" · X ",
						h.x,
						" Y ",
						h.y
					]
				}) : null
			]
		}), /* @__PURE__ */ V("div", {
			className: `vt-device-bezel ${d ? "compact" : ""}`,
			style: {
				width: p + (d ? 14 : 22),
				height: m + (d ? 14 : 22)
			},
			children: [/* @__PURE__ */ B("div", { className: "vt-device-camera" }), /* @__PURE__ */ B("div", {
				className: "vt-device-viewport",
				style: {
					width: p,
					height: m
				},
				children: /* @__PURE__ */ B("iframe", {
					ref: ee,
					title: `${f.label} preview at ${f.width} by ${f.height}`,
					src: o,
					style: {
						width: f.width,
						height: f.height,
						transform: `scale(${a})`
					},
					onLoad: (e) => g(e.currentTarget)
				})
			})]
		})]
	});
}
function wn({ value: e, onChange: t, includeAll: n = !0, showHoverHints: r = !0 }) {
	return /* @__PURE__ */ V("div", {
		className: "vt-device-switcher",
		role: "group",
		"aria-label": "Responsive preview device",
		children: [Object.keys(hn).map((n) => {
			let i = hn[n], a = i.icon;
			return /* @__PURE__ */ V("button", {
				className: e === n ? "active" : "",
				onClick: () => t(n),
				"aria-label": `${i.label} ${i.width} by ${i.height}`,
				title: r ? `${i.label} ${i.width} by ${i.height}` : void 0,
				children: [/* @__PURE__ */ B(a, { size: 16 }), /* @__PURE__ */ B("span", {
					className: "vt-toolbar-label",
					children: i.label
				})]
			}, n);
		}), n ? /* @__PURE__ */ V("button", {
			className: e === "all" ? "active" : "",
			onClick: () => t("all"),
			"aria-label": "Preview all devices",
			title: r ? "Preview all devices" : void 0,
			children: [/* @__PURE__ */ B(ze, { size: 16 }), /* @__PURE__ */ B("span", {
				className: "vt-toolbar-label",
				children: "All"
			})]
		}) : null]
	});
}
function Tn({ mode: e, onModeChange: t, onClose: r, changes: i, selectedSelector: a, selectedLabel: o, onMeasurement: s }) {
	let c = Sn(), l = n(() => xn(), []), u = Math.max(320, c.height - 132), d = e === "all" ? 1 : Math.min((c.width - 72) / hn[e].width, u / hn[e].height, 1), f = hn.desktop.width + hn.tablet.width + hn.phone.width, p = Math.min((c.width - 160) / f, u / Math.max(hn.desktop.height, hn.tablet.height, hn.phone.height), 1);
	return /* @__PURE__ */ V("div", {
		className: "vt-responsive-preview",
		"data-visual-truth-ui": !0,
		children: [/* @__PURE__ */ V("header", {
			className: "vt-preview-toolbar",
			children: [
				/* @__PURE__ */ V("div", {
					className: "vt-preview-title",
					children: [/* @__PURE__ */ B("strong", { children: "Responsive truth" }), /* @__PURE__ */ B("span", { children: "Live page · exact CSS dimensions" })]
				}),
				/* @__PURE__ */ B(wn, {
					value: e,
					onChange: t
				}),
				/* @__PURE__ */ B("button", {
					className: "vt-return-editing",
					onClick: r,
					children: "Return to editing"
				}),
				/* @__PURE__ */ B("button", {
					className: "vt-preview-close",
					onClick: r,
					title: "Close preview",
					children: /* @__PURE__ */ B(bt, { size: 17 })
				})
			]
		}), /* @__PURE__ */ B("main", {
			className: `vt-preview-workspace ${e === "all" ? "all" : "single"}`,
			children: e === "all" ? /* @__PURE__ */ V(z, { children: [
				/* @__PURE__ */ B(Cn, {
					device: "desktop",
					scale: p,
					src: l,
					changes: i,
					selectedSelector: a,
					selectedLabel: o,
					onMeasurement: s,
					compact: !0
				}),
				/* @__PURE__ */ B(Cn, {
					device: "tablet",
					scale: p,
					src: l,
					changes: i,
					selectedSelector: a,
					selectedLabel: o,
					onMeasurement: s,
					compact: !0
				}),
				/* @__PURE__ */ B(Cn, {
					device: "phone",
					scale: p,
					src: l,
					changes: i,
					selectedSelector: a,
					selectedLabel: o,
					onMeasurement: s,
					compact: !0
				})
			] }) : /* @__PURE__ */ B(Cn, {
				device: e,
				scale: d,
				src: l,
				changes: i,
				selectedSelector: a,
				selectedLabel: o,
				onMeasurement: s
			})
		})]
	});
}
//#endregion
//#region src/visual-truth/SelectionOverlay.tsx
var En = [
	"nw",
	"n",
	"ne",
	"e",
	"se",
	"s",
	"sw",
	"w"
], Dn = [
	{
		name: "Black",
		value: "#111111"
	},
	{
		name: "White",
		value: "#ffffff"
	},
	{
		name: "Blue",
		value: "#2684ff"
	},
	{
		name: "Coral",
		value: "#e65f4f"
	},
	{
		name: "Green",
		value: "#238e58"
	},
	{
		name: "Yellow",
		value: "#f5c84c"
	}
], On = [
	{
		label: "None",
		value: "none"
	},
	{
		label: "S",
		value: "0 2px 8px rgb(0 0 0 / 12%)"
	},
	{
		label: "M",
		value: "0 8px 24px rgb(0 0 0 / 16%)"
	},
	{
		label: "L",
		value: "0 18px 48px rgb(0 0 0 / 20%)"
	}
], kn = [
	["Arial", "Arial, sans-serif"],
	["DM Sans", "\"DM Sans\", sans-serif"],
	["Georgia", "Georgia, serif"],
	["Helvetica", "Helvetica, Arial, sans-serif"],
	["Manrope", "Manrope, sans-serif"],
	["Times", "\"Times New Roman\", serif"]
], An = [{
	title: "Margin",
	fields: [
		{
			label: "T",
			name: "margin top",
			property: "margin-top"
		},
		{
			label: "R",
			name: "margin right",
			property: "margin-right"
		},
		{
			label: "B",
			name: "margin bottom",
			property: "margin-bottom"
		},
		{
			label: "L",
			name: "margin left",
			property: "margin-left"
		}
	]
}, {
	title: "Padding",
	fields: [
		{
			label: "T",
			name: "padding top",
			property: "padding-top"
		},
		{
			label: "R",
			name: "padding right",
			property: "padding-right"
		},
		{
			label: "B",
			name: "padding bottom",
			property: "padding-bottom"
		},
		{
			label: "L",
			name: "padding left",
			property: "padding-left"
		}
	]
}];
function jn({ label: e, name: t, property: n, value: r, step: i, onAdjust: a }) {
	return /* @__PURE__ */ V("div", {
		className: "vt-spacing-field",
		children: [/* @__PURE__ */ B("span", {
			title: t,
			children: e
		}), /* @__PURE__ */ V("div", { children: [
			/* @__PURE__ */ B("button", {
				"aria-label": `Decrease ${t} by ${i}px`,
				title: `Decrease ${t} by ${i}px`,
				onClick: () => a(n, -i),
				children: /* @__PURE__ */ B(M, { size: 11 })
			}),
			/* @__PURE__ */ B("code", { children: Math.round(r) }),
			/* @__PURE__ */ B("button", {
				"aria-label": `Increase ${t} by ${i}px`,
				title: `Increase ${t} by ${i}px`,
				onClick: () => a(n, i),
				children: /* @__PURE__ */ B(Ze, { size: 11 })
			})
		] })]
	});
}
function Mn(e) {
	if (/^#[\da-f]{6}$/i.test(e)) return e;
	let t = e.match(/[\d.]+/g)?.slice(0, 3).map(Number);
	return !t || t.length < 3 ? "#ffffff" : `#${t.map((e) => Math.max(0, Math.min(255, Math.round(e))).toString(16).padStart(2, "0")).join("")}`;
}
function Nn({ label: e, property: t, value: n, clearable: r = !1, onChange: i }) {
	return /* @__PURE__ */ V("div", {
		className: "vt-color-control",
		children: [
			/* @__PURE__ */ B("strong", { children: e }),
			/* @__PURE__ */ B("div", {
				className: "vt-color-swatches",
				children: Dn.map((n) => /* @__PURE__ */ B("button", {
					"aria-label": `Set ${e.toLowerCase()} to ${n.name}`,
					title: n.name,
					style: { backgroundColor: n.value },
					onClick: () => i(t, n.value)
				}, n.value))
			}),
			/* @__PURE__ */ B("label", {
				className: "vt-custom-color",
				title: `Custom ${e.toLowerCase()}`,
				children: /* @__PURE__ */ B("input", {
					type: "color",
					"aria-label": `Custom ${e.toLowerCase()} color`,
					value: Mn(n),
					onChange: (e) => i(t, e.target.value)
				})
			}),
			r ? /* @__PURE__ */ B("button", {
				className: "vt-clear-color",
				"aria-label": `Clear ${e.toLowerCase()}`,
				title: `Clear ${e.toLowerCase()}`,
				onClick: () => i(t, "transparent"),
				children: /* @__PURE__ */ B(Ce, { size: 12 })
			}) : null
		]
	});
}
function Pn({ label: e, value: t, step: n, suffix: r, onDecrease: i, onIncrease: a }) {
	return /* @__PURE__ */ V("div", {
		className: "vt-appearance-stepper",
		children: [/* @__PURE__ */ B("span", { children: e }), /* @__PURE__ */ V("div", { children: [
			/* @__PURE__ */ B("button", {
				"aria-label": `Decrease ${e.toLowerCase()} by ${n}${r}`,
				onClick: i,
				children: /* @__PURE__ */ B(M, { size: 11 })
			}),
			/* @__PURE__ */ V("code", { children: [Math.round(t), r] }),
			/* @__PURE__ */ B("button", {
				"aria-label": `Increase ${e.toLowerCase()} by ${n}${r}`,
				onClick: a,
				children: /* @__PURE__ */ B(Ze, { size: 11 })
			})
		] })]
	});
}
function Fn({ label: e, dimension: t, value: n, step: r, onResize: i }) {
	let a = t === "width" ? 24 : 20;
	return /* @__PURE__ */ V("label", {
		className: "vt-size-field",
		children: [/* @__PURE__ */ B("span", { children: e }), /* @__PURE__ */ V("div", { children: [
			/* @__PURE__ */ B("button", {
				type: "button",
				"aria-label": `Decrease ${t}`,
				title: `Decrease ${t} by ${r}px`,
				onClick: () => i(t, `${Math.max(a, Math.round(n - r))}px`),
				children: /* @__PURE__ */ B(M, { size: 12 })
			}),
			/* @__PURE__ */ B("input", {
				type: "number",
				min: a,
				step: r,
				"aria-label": `${e} in pixels`,
				value: Math.round(n),
				onChange: (e) => i(t, `${Math.max(a, Number(e.target.value) || a)}px`)
			}),
			/* @__PURE__ */ B("code", { children: "px" }),
			/* @__PURE__ */ B("button", {
				type: "button",
				"aria-label": `Increase ${t}`,
				title: `Increase ${t} by ${r}px`,
				onClick: () => i(t, `${Math.round(n + r)}px`),
				children: /* @__PURE__ */ B(Ze, { size: 12 })
			})
		] })]
	});
}
function In({ value: e, onChange: t }) {
	return /* @__PURE__ */ B("div", {
		className: "vt-popover-step",
		role: "group",
		"aria-label": "Adjustment step",
		children: [
			1,
			5,
			10
		].map((n) => /* @__PURE__ */ B("button", {
			className: e === n ? "active" : "",
			"aria-pressed": e === n,
			"aria-label": `Use ${n}px step`,
			onClick: () => t(n),
			children: n
		}, n))
	});
}
function Ln({ label: e, axis: t, value: n, otherValue: r, step: i, onTranslate: a }) {
	let o = (e) => t === "x" ? a(e, r) : a(r, e);
	return /* @__PURE__ */ V("label", {
		className: "vt-position-field",
		children: [/* @__PURE__ */ B("span", { children: e }), /* @__PURE__ */ V("div", { children: [
			/* @__PURE__ */ B("button", {
				"aria-label": `Decrease ${t} position`,
				title: `Decrease ${t.toUpperCase()} by ${i}px`,
				onClick: () => o(Math.round(n - i)),
				children: /* @__PURE__ */ B(M, { size: 12 })
			}),
			/* @__PURE__ */ B("input", {
				"aria-label": `${e} position in pixels`,
				type: "number",
				step: i,
				value: Math.round(n),
				onChange: (e) => o(Number(e.target.value) || 0)
			}),
			/* @__PURE__ */ B("code", { children: "px" }),
			/* @__PURE__ */ B("button", {
				"aria-label": `Increase ${t} position`,
				title: `Increase ${t.toUpperCase()} by ${i}px`,
				onClick: () => o(Math.round(n + i)),
				children: /* @__PURE__ */ B(Ze, { size: 12 })
			})
		] })]
	});
}
function K(e) {
	let t = e.toLowerCase().replaceAll("\"", "");
	return kn.find(([, e]) => t.startsWith(e.toLowerCase().replaceAll("\"", "").split(",")[0]))?.[1] ?? "current";
}
function Rn(e) {
	return !e || e === "none" ? "none" : e.includes("18px 48px") ? On[3].value : e.includes("8px 24px") ? On[2].value : e.includes("2px 8px") ? On[1].value : "current";
}
function q(e) {
	let t = Math.round(e);
	return `${t > 0 ? "+" : ""}${t}px`;
}
function zn(e, t = !1) {
	let n = Math.round(e * 10) / 10;
	return `${t && n > 0 ? "+" : ""}${n}px`;
}
function J(e) {
	if (e === "gap") return "Gap";
	let [t, n] = e.split("-");
	return `${t[0].toUpperCase()}${t.slice(1)} ${n}`;
}
function Bn(e) {
	return e === "color" ? "Text" : e === "background-color" ? "Fill" : e === "border-color" ? "Border color" : e === "border-width" ? "Border width" : e === "border-radius" ? "Radius" : e === "box-shadow" ? "Shadow" : "Opacity";
}
function Vn(e) {
	return e === "transparent" || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)/i.test(e) || /rgb\([^)]*\/\s*0(?:\.0+)?\s*\)/i.test(e);
}
function Hn(e, t) {
	if (e === "color" || e === "background-color" || e === "border-color") return Vn(t) ? "Clear" : Mn(t).toUpperCase();
	if (e === "border-width" || e === "border-radius") return zn(Number.parseFloat(t) || 0);
	if (e === "opacity") return `${Math.round((Number.parseFloat(t) || 0) * 1e3) / 10}%`;
	let n = Rn(t);
	return n === "none" ? "None" : n === On[1].value ? "Small" : n === On[2].value ? "Medium" : n === On[3].value ? "Large" : "Custom";
}
function Un(e, t) {
	if (e === "opacity") {
		let e = Math.round(t * 10) / 10;
		return `${e > 0 ? "+" : ""}${e}%`;
	}
	return zn(t, !0);
}
function Wn({ element: e, revision: t, onMoveStart: n, onResizeStart: r, liveReadout: o = null, editing: u = !1, onDoubleClick: p, onContextMenu: y, onNudge: b, position: re, onTranslate: ae, onAlign: oe, onScale: se, size: ce, aspectLocked: x, onAspectLocked: S, onResize: le, onFitParent: ue, onFontSize: de, typography: C, onTypography: w, spacing: fe, showGap: pe = !1, onSpacing: me, appearance: T, onAppearance: he, hasChanges: ge, copied: _e, onSendToCodex: ve, canAdjustText: be = !1, textDragBehavior: xe = "scale", onTextDragBehavior: Se, locked: Ce = !1, easyMode: we = !1 }) {
	let [E, Te] = i(1), [Ee, De] = i(!1), [Oe, ke] = i(!1), [Ae, je] = i(!1), [Me, Ne] = i(!1), [Pe, Fe] = i(!1), D = e.getBoundingClientRect(), Ie = be ? 684 : 455, Le = Array.from(document.querySelectorAll(".vt-layers, .vt-elements, .vt-studio, .vt-inspector")).map((e) => e.getBoundingClientRect()).filter((e) => e.width > 0 && e.height > 0), Re = Le.filter((e) => e.left <= window.innerWidth / 2 && e.right < window.innerWidth).reduce((e, t) => Math.max(e, t.right), 0), ze = Le.filter((e) => e.right >= window.innerWidth / 2 && e.left > 0).reduce((e, t) => Math.min(e, t.left), window.innerWidth), Be = document.querySelector(".vt-ruler-vertical")?.getBoundingClientRect(), Ve = document.querySelector(".vt-ruler-horizontal")?.getBoundingClientRect(), O = Math.max(Re ? Re + 8 : 8, Be?.width ? Be.right + 8 : 8), k = ze < window.innerWidth ? ze - 8 : window.innerWidth - 8, He = Math.max(8, Ve?.height ? Ve.bottom + 8 : 8), We = o?.kind === "appearance" || o?.kind === "spacing" || o?.kind === "resize" ? 240 : o ? 180 : 150, Ge = Math.max(O + We / 2, Math.min(D.left + D.width / 2, k - We / 2)) - D.left, j = Math.max(O, Math.min(D.left + 32, Math.max(O, k - Ie))) - D.left, Ke = D.top - 38 >= He ? -38 : D.height + 8, N = Math.min(500, Math.max(376, k - O)), qe = Math.max(O, Math.min(D.left + 32, Math.max(O, k - N))) - D.left, Je = pe ? 190 : 150, Ye = D.bottom + Je + 8 <= window.innerHeight - 48 ? D.height + 8 : Math.max(He - D.top, -(Je + 8)), F = Math.min(480, Math.max(376, k - O)), Xe = Math.max(O, Math.min(D.left + 32, Math.max(O, k - F))) - D.left, L = be ? 220 : 190, Qe = D.bottom + L + 8 <= window.innerHeight - 48 ? D.height + 8 : Math.max(He - D.top, -(L + 8)), $e = Math.min(390, Math.max(340, k - O)), tt = Math.max(O, Math.min(D.left + 32, Math.max(O, k - $e))) - D.left, nt = D.bottom + 112 + 8 <= window.innerHeight - 48 ? D.height + 8 : Math.max(He - D.top, -120), rt = Math.min(440, Math.max(380, k - O)), at = Math.max(O, Math.min(D.left + 32, Math.max(O, k - rt))) - D.left, ot = D.bottom + 154 + 8 <= window.innerHeight - 48 ? D.height + 8 : Math.max(He - D.top, -162), st = Math.min(420, Math.max(360, k - O)), ct = Math.max(O, Math.min(D.left + 32, Math.max(O, k - st))) - D.left, lt = D.bottom + 112 + 8 <= window.innerHeight - 48 ? D.height + 8 : Math.max(He - D.top, -120), ut = Pe ? {
		top: lt,
		height: 112
	} : Ae ? {
		top: nt,
		height: 112
	} : Me ? {
		top: ot,
		height: 154
	} : Ee ? {
		top: Ye,
		height: Je
	} : Oe ? {
		top: Qe,
		height: L
	} : null, dt = document.querySelector(".vt-statusbar")?.getBoundingClientRect().top ?? window.innerHeight - 8, ft = ut ? D.top + ut.top + ut.height + 4 : 0, pt = D.left - O, mt = k - D.right, gt = { left: Ge };
	return ut && ut.top >= D.height && (gt = ft + 21 <= dt ? {
		left: Ge,
		top: ut.top + ut.height + 4,
		bottom: "auto"
	} : pt >= We + 8 ? {
		left: -(We / 2 + 8),
		top: D.height / 2 - 9,
		bottom: "auto"
	} : mt >= We + 8 ? {
		left: D.width + We / 2 + 8,
		top: D.height / 2 - 9,
		bottom: "auto"
	} : {
		left: Ge,
		top: dt - D.top - 21,
		bottom: "auto"
	}), /* @__PURE__ */ V("div", {
		className: `vt-selection ${u ? "editing" : ""}`,
		"data-visual-truth-ui": !0,
		style: {
			left: D.left,
			top: D.top,
			width: D.width,
			height: D.height
		},
		children: [
			Ce ? /* @__PURE__ */ B("span", {
				className: "vt-lock-handle",
				title: "Element is locked",
				children: /* @__PURE__ */ B(Ue, { size: 13 })
			}) : /* @__PURE__ */ B("button", {
				className: "vt-move-handle",
				"aria-label": "Move selected element",
				title: "Drag this handle or anywhere inside the selected box. Hold Shift to lock one axis or Option to bypass snapping.",
				onPointerDown: n,
				onDoubleClick: (e) => {
					e.stopPropagation(), p();
				},
				onContextMenu: y,
				children: /* @__PURE__ */ B(P, { size: 13 })
			}),
			!Ce && we && be ? /* @__PURE__ */ V("div", {
				className: "vt-quick-adjust vt-quick-easy",
				role: "toolbar",
				"aria-label": "Quick text controls",
				style: {
					left: j,
					top: Ke
				},
				children: [
					/* @__PURE__ */ B("button", {
						className: "vt-easy-type-button",
						"aria-label": "Decrease selected text size",
						onClick: () => de(-1),
						children: "A−"
					}),
					/* @__PURE__ */ B("input", {
						"aria-label": "Selected font size",
						type: "number",
						min: "8",
						max: "240",
						value: Math.round(C.fontSize),
						onChange: (e) => w("font-size", `${Math.max(8, Number(e.target.value) || 8)}px`)
					}),
					/* @__PURE__ */ B("button", {
						className: "vt-easy-type-button",
						"aria-label": "Increase selected text size",
						onClick: () => de(1),
						children: "A+"
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ V("div", {
						className: "vt-text-resize-mode",
						role: "group",
						"aria-label": "Text resize behavior",
						children: [/* @__PURE__ */ B("button", {
							className: xe === "scale" ? "active" : "",
							"aria-pressed": xe === "scale",
							title: "Resize the text box and font together",
							onClick: () => Se?.("scale"),
							children: "Text + box"
						}), /* @__PURE__ */ B("button", {
							className: xe === "reflow" ? "active" : "",
							"aria-pressed": xe === "reflow",
							title: "Resize only the box and keep the font size",
							onClick: () => Se?.("reflow"),
							children: "Box only"
						})]
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B("button", {
						className: C.textAlign === "left" || C.textAlign === "start" ? "active" : "",
						"aria-label": "Align text left",
						onClick: () => w("text-align", "left"),
						children: /* @__PURE__ */ B(d, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						className: C.textAlign === "center" ? "active" : "",
						"aria-label": "Align text center",
						onClick: () => w("text-align", "center"),
						children: /* @__PURE__ */ B(a, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						className: C.textAlign === "right" || C.textAlign === "end" ? "active" : "",
						"aria-label": "Align text right",
						onClick: () => w("text-align", "right"),
						children: /* @__PURE__ */ B(f, { size: 14 })
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B("button", {
						className: Ee ? "active" : "",
						"aria-label": "Adjust padding and spacing",
						onClick: () => De((e) => !e),
						children: /* @__PURE__ */ B(ne, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Edit text",
						onClick: p,
						children: /* @__PURE__ */ B(ht, { size: 14 })
					})
				]
			}) : null,
			!Ce && we && !be ? /* @__PURE__ */ V("div", {
				className: "vt-quick-adjust vt-quick-easy",
				role: "toolbar",
				"aria-label": "Quick element controls",
				style: {
					left: j,
					top: Ke
				},
				children: [
					/* @__PURE__ */ B("button", {
						className: Ae ? "active" : "",
						"aria-label": "Adjust exact size",
						onClick: () => {
							je((e) => !e), De(!1), ke(!1);
						},
						children: /* @__PURE__ */ B(A, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						className: Ee ? "active" : "",
						"aria-label": "Adjust padding and gap",
						onClick: () => {
							De((e) => !e), je(!1), ke(!1);
						},
						children: /* @__PURE__ */ B(ne, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						className: Oe ? "active" : "",
						"aria-label": "Adjust appearance",
						onClick: () => {
							ke((e) => !e), je(!1), De(!1);
						},
						children: /* @__PURE__ */ B(I, { size: 14 })
					})
				]
			}) : null,
			Ce ? null : /* @__PURE__ */ V("div", {
				className: "vt-quick-adjust",
				role: "toolbar",
				"aria-label": "Quick adjust selected element",
				style: {
					left: j,
					top: Ke
				},
				children: [
					/* @__PURE__ */ B("div", {
						className: "vt-quick-adjust-step",
						role: "group",
						"aria-label": "Movement amount",
						children: [
							1,
							5,
							10
						].map((e) => /* @__PURE__ */ B("button", {
							className: E === e ? "active" : "",
							"aria-pressed": E === e,
							title: `Move by ${e}px`,
							onClick: () => Te(e),
							children: e
						}, e))
					}),
					be ? /* @__PURE__ */ V(z, { children: [/* @__PURE__ */ B("i", {}), /* @__PURE__ */ V("div", {
						className: "vt-text-resize-mode",
						role: "group",
						"aria-label": "Text resize behavior",
						children: [/* @__PURE__ */ B("button", {
							className: xe === "scale" ? "active" : "",
							"aria-pressed": xe === "scale",
							title: "Resize the text box and font together",
							onClick: () => Se?.("scale"),
							children: "Text + box"
						}), /* @__PURE__ */ B("button", {
							className: xe === "reflow" ? "active" : "",
							"aria-pressed": xe === "reflow",
							title: "Resize only the box and keep the font size",
							onClick: () => Se?.("reflow"),
							children: "Box only"
						})]
					})] }) : null,
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B("button", {
						"aria-label": `Move left ${E}px`,
						title: `Move left ${E}px`,
						onClick: () => b(-E, 0),
						children: /* @__PURE__ */ B(g, { size: 13 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": `Move up ${E}px`,
						title: `Move up ${E}px`,
						onClick: () => b(0, -E),
						children: /* @__PURE__ */ B(v, { size: 13 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": `Move down ${E}px`,
						title: `Move down ${E}px`,
						onClick: () => b(0, E),
						children: /* @__PURE__ */ B(te, { size: 13 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": `Move right ${E}px`,
						title: `Move right ${E}px`,
						onClick: () => b(E, 0),
						children: /* @__PURE__ */ B(_, { size: 13 })
					}),
					/* @__PURE__ */ B("button", {
						className: Pe ? "active" : "",
						"aria-label": "Adjust position and alignment",
						"aria-pressed": Pe,
						title: "Adjust position and alignment",
						onClick: () => {
							Fe((e) => !e), je(!1), De(!1), ke(!1), Ne(!1);
						},
						children: /* @__PURE__ */ B(ye, { size: 13 })
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Make selected element smaller",
						title: "Make 5% smaller",
						onClick: () => se(.95),
						children: /* @__PURE__ */ B(M, { size: 13 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Make selected element larger",
						title: "Make 5% larger",
						onClick: () => se(1.05),
						children: /* @__PURE__ */ B(Ze, { size: 13 })
					}),
					/* @__PURE__ */ B("button", {
						className: Ae ? "active" : "",
						"aria-label": "Adjust exact size",
						"aria-pressed": Ae,
						title: "Adjust exact size",
						onClick: () => {
							je((e) => !e), De(!1), ke(!1), Ne(!1), Fe(!1);
						},
						children: /* @__PURE__ */ B(A, { size: 13 })
					}),
					be ? /* @__PURE__ */ V(z, { children: [
						/* @__PURE__ */ B("i", {}),
						/* @__PURE__ */ B("button", {
							className: "vt-quick-adjust-type",
							"aria-label": "Decrease selected text size",
							title: "Decrease text size 1px",
							onClick: () => de(-1),
							children: "A-"
						}),
						/* @__PURE__ */ B("button", {
							className: "vt-quick-adjust-type",
							"aria-label": "Increase selected text size",
							title: "Increase text size 1px",
							onClick: () => de(1),
							children: "A+"
						}),
						/* @__PURE__ */ B("button", {
							className: Me ? "active" : "",
							"aria-label": "Adjust typography",
							"aria-pressed": Me,
							title: "Adjust typography",
							onClick: () => {
								Ne((e) => !e), je(!1), De(!1), ke(!1), Fe(!1);
							},
							children: /* @__PURE__ */ B(ht, { size: 13 })
						})
					] }) : null,
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B("button", {
						className: Ee ? "active" : "",
						"aria-label": "Adjust margin and padding",
						"aria-pressed": Ee,
						title: "Adjust margin and padding",
						onClick: () => {
							De((e) => !e), ke(!1), je(!1), Ne(!1), Fe(!1);
						},
						children: /* @__PURE__ */ B(ne, { size: 13 })
					}),
					/* @__PURE__ */ B("button", {
						className: Oe ? "active" : "",
						"aria-label": "Adjust colors and appearance",
						"aria-pressed": Oe,
						title: "Adjust colors and appearance",
						onClick: () => {
							ke((e) => !e), De(!1), je(!1), Ne(!1), Fe(!1);
						},
						children: /* @__PURE__ */ B(I, { size: 13 })
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B("button", {
						className: _e ? "vt-quick-send sent" : "vt-quick-send",
						disabled: !ge,
						"aria-label": _e ? "Ready in Codex" : "Send changes to Codex",
						title: _e ? "Ready in Codex" : ge ? "Send changes to Codex" : "Make a visual change first",
						onClick: ve,
						children: B(_e ? ie : it, { size: 13 })
					})
				]
			}),
			Ce || !Pe ? null : /* @__PURE__ */ V("div", {
				className: "vt-position-popover",
				role: "group",
				"aria-label": "On-canvas position and alignment controls",
				style: {
					left: ct,
					top: lt,
					width: st
				},
				children: [
					/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B("strong", { children: "Position & Align" }), /* @__PURE__ */ B(In, {
						value: E,
						onChange: Te
					})] }),
					/* @__PURE__ */ V("div", {
						className: "vt-position-fields",
						children: [/* @__PURE__ */ B(Ln, {
							label: "X",
							axis: "x",
							value: re.x,
							otherValue: re.y,
							step: E,
							onTranslate: ae
						}), /* @__PURE__ */ B(Ln, {
							label: "Y",
							axis: "y",
							value: re.y,
							otherValue: re.x,
							step: E,
							onTranslate: ae
						})]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-position-actions",
						role: "group",
						"aria-label": "Align selected element to parent",
						children: [
							/* @__PURE__ */ B("button", {
								"aria-label": "Reset position",
								title: "Reset position",
								onClick: () => ae(0, 0),
								children: /* @__PURE__ */ B(et, { size: 13 })
							}),
							/* @__PURE__ */ B("i", {}),
							/* @__PURE__ */ B("button", {
								"aria-label": "Align left in parent",
								title: "Align left in parent",
								onClick: () => oe("horizontal", "start"),
								children: /* @__PURE__ */ B(l, { size: 13 })
							}),
							/* @__PURE__ */ B("button", {
								"aria-label": "Center horizontally in parent",
								title: "Center horizontally in parent",
								onClick: () => oe("horizontal", "center"),
								children: /* @__PURE__ */ B(s, { size: 13 })
							}),
							/* @__PURE__ */ B("button", {
								"aria-label": "Align right in parent",
								title: "Align right in parent",
								onClick: () => oe("horizontal", "end"),
								children: /* @__PURE__ */ B(c, { size: 13 })
							}),
							/* @__PURE__ */ B("i", {}),
							/* @__PURE__ */ B("button", {
								"aria-label": "Align top in parent",
								title: "Align top in parent",
								onClick: () => oe("vertical", "start"),
								children: /* @__PURE__ */ B(h, { size: 13 })
							}),
							/* @__PURE__ */ B("button", {
								"aria-label": "Center vertically in parent",
								title: "Center vertically in parent",
								onClick: () => oe("vertical", "center"),
								children: /* @__PURE__ */ B(m, { size: 13 })
							}),
							/* @__PURE__ */ B("button", {
								"aria-label": "Align bottom in parent",
								title: "Align bottom in parent",
								onClick: () => oe("vertical", "end"),
								children: /* @__PURE__ */ B(ee, { size: 13 })
							})
						]
					})
				]
			}),
			Ce || !Ae ? null : /* @__PURE__ */ V("div", {
				className: "vt-size-popover",
				role: "group",
				"aria-label": "On-canvas size controls",
				style: {
					left: tt,
					top: nt,
					width: $e
				},
				children: [
					/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B("strong", { children: "Size" }), /* @__PURE__ */ B(In, {
						value: E,
						onChange: Te
					})] }),
					/* @__PURE__ */ V("div", {
						className: "vt-size-fields",
						children: [/* @__PURE__ */ B(Fn, {
							label: "Width",
							dimension: "width",
							value: ce.width,
							step: E,
							onResize: le
						}), /* @__PURE__ */ B(Fn, {
							label: "Height",
							dimension: "height",
							value: ce.height,
							step: E,
							onResize: le
						})]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-size-actions",
						children: [/* @__PURE__ */ V("button", {
							className: x ? "active" : "",
							"aria-pressed": x,
							onClick: () => S(!x),
							children: [B(x ? Ue : R, { size: 13 }), x ? "Ratio locked" : "Lock ratio"]
						}), /* @__PURE__ */ V("button", {
							onClick: ue,
							children: [/* @__PURE__ */ B(A, { size: 13 }), "Fill parent width"]
						})]
					})
				]
			}),
			Ce || !be || !Me ? null : /* @__PURE__ */ V("div", {
				className: "vt-type-popover",
				role: "group",
				"aria-label": "On-canvas typography controls",
				style: {
					left: at,
					top: ot,
					width: rt
				},
				children: [
					/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B("strong", { children: "Type" }), /* @__PURE__ */ B(In, {
						value: E,
						onChange: Te
					})] }),
					/* @__PURE__ */ V("div", {
						className: "vt-type-top",
						children: [/* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B("span", { children: "Font" }), /* @__PURE__ */ V("select", {
							"aria-label": "Font family",
							value: K(C.fontFamily),
							onChange: (e) => w("font-family", e.target.value),
							children: [/* @__PURE__ */ B("option", {
								value: "current",
								disabled: !0,
								children: "Current"
							}), kn.map(([e, t]) => /* @__PURE__ */ B("option", {
								value: t,
								children: e
							}, t))]
						})] }), /* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B("span", { children: "Size" }), /* @__PURE__ */ V("div", { children: [
							/* @__PURE__ */ B("button", {
								"aria-label": "Decrease font size",
								onClick: () => w("font-size", `${Math.max(8, Math.round(C.fontSize - E))}px`),
								children: /* @__PURE__ */ B(M, { size: 11 })
							}),
							/* @__PURE__ */ B("input", {
								"aria-label": "Font size in pixels",
								type: "number",
								min: "8",
								value: Math.round(C.fontSize),
								onChange: (e) => w("font-size", `${Math.max(8, Number(e.target.value) || 8)}px`)
							}),
							/* @__PURE__ */ B("button", {
								"aria-label": "Increase font size",
								onClick: () => w("font-size", `${Math.round(C.fontSize + E)}px`),
								children: /* @__PURE__ */ B(Ze, { size: 11 })
							})
						] })] })]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-type-measures",
						children: [/* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B("span", { children: "Line" }), /* @__PURE__ */ V("div", { children: [
							/* @__PURE__ */ B("button", {
								"aria-label": "Decrease line height",
								onClick: () => w("line-height", String(Math.max(.8, C.lineHeight - .05))),
								children: /* @__PURE__ */ B(M, { size: 11 })
							}),
							/* @__PURE__ */ B("code", { children: C.lineHeight.toFixed(2) }),
							/* @__PURE__ */ B("button", {
								"aria-label": "Increase line height",
								onClick: () => w("line-height", String(Math.min(2, C.lineHeight + .05))),
								children: /* @__PURE__ */ B(Ze, { size: 11 })
							})
						] })] }), /* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B("span", { children: "Track" }), /* @__PURE__ */ V("div", { children: [
							/* @__PURE__ */ B("button", {
								"aria-label": "Decrease letter spacing",
								onClick: () => w("letter-spacing", `${C.letterSpacing - .5}px`),
								children: /* @__PURE__ */ B(M, { size: 11 })
							}),
							/* @__PURE__ */ B("code", { children: C.letterSpacing.toFixed(1) }),
							/* @__PURE__ */ B("button", {
								"aria-label": "Increase letter spacing",
								onClick: () => w("letter-spacing", `${C.letterSpacing + .5}px`),
								children: /* @__PURE__ */ B(Ze, { size: 11 })
							})
						] })] })]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-type-bottom",
						children: [/* @__PURE__ */ B("div", {
							role: "group",
							"aria-label": "Font weight",
							children: [
								["R", "400"],
								["M", "500"],
								["S", "600"],
								["B", "700"]
							].map(([e, t]) => /* @__PURE__ */ B("button", {
								className: C.fontWeight === t ? "active" : "",
								"aria-pressed": C.fontWeight === t,
								"aria-label": `Font weight ${t}`,
								onClick: () => w("font-weight", t),
								children: e
							}, t))
						}), /* @__PURE__ */ V("div", {
							role: "group",
							"aria-label": "Text alignment",
							children: [
								/* @__PURE__ */ B("button", {
									className: C.textAlign === "left" || C.textAlign === "start" ? "active" : "",
									"aria-pressed": C.textAlign === "left" || C.textAlign === "start",
									"aria-label": "Align text left",
									onClick: () => w("text-align", "left"),
									children: /* @__PURE__ */ B(d, { size: 13 })
								}),
								/* @__PURE__ */ B("button", {
									className: C.textAlign === "center" ? "active" : "",
									"aria-pressed": C.textAlign === "center",
									"aria-label": "Align text center",
									onClick: () => w("text-align", "center"),
									children: /* @__PURE__ */ B(a, { size: 13 })
								}),
								/* @__PURE__ */ B("button", {
									className: C.textAlign === "right" || C.textAlign === "end" ? "active" : "",
									"aria-pressed": C.textAlign === "right" || C.textAlign === "end",
									"aria-label": "Align text right",
									onClick: () => w("text-align", "right"),
									children: /* @__PURE__ */ B(f, { size: 13 })
								})
							]
						})]
					})
				]
			}),
			Ce || !Ee ? null : /* @__PURE__ */ V("div", {
				className: "vt-spacing-popover",
				role: "group",
				"aria-label": "On-canvas spacing controls",
				style: {
					left: qe,
					top: Ye,
					width: N
				},
				children: [
					/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B("strong", { children: "Spacing" }), /* @__PURE__ */ B(In, {
						value: E,
						onChange: Te
					})] }),
					An.map((e) => /* @__PURE__ */ V("section", {
						"aria-label": e.title,
						children: [/* @__PURE__ */ B("strong", { children: e.title }), /* @__PURE__ */ B("div", { children: e.fields.map((e) => /* @__PURE__ */ B(jn, {
							...e,
							value: fe[e.property],
							step: E,
							onAdjust: me
						}, e.property)) })]
					}, e.title)),
					pe ? /* @__PURE__ */ V("section", {
						className: "vt-spacing-gap",
						"aria-label": "Container gap",
						children: [/* @__PURE__ */ B("strong", { children: "Gap" }), /* @__PURE__ */ B("div", { children: /* @__PURE__ */ B(jn, {
							label: "G",
							name: "container gap",
							property: "gap",
							value: fe.gap,
							step: E,
							onAdjust: me
						}) })]
					}) : null
				]
			}),
			Ce || !Oe ? null : /* @__PURE__ */ V("div", {
				className: "vt-appearance-popover",
				role: "group",
				"aria-label": "On-canvas appearance controls",
				style: {
					left: Xe,
					top: Qe,
					width: F
				},
				children: [
					/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B("strong", { children: "Style" }), /* @__PURE__ */ B(In, {
						value: E,
						onChange: Te
					})] }),
					be ? /* @__PURE__ */ B(Nn, {
						label: "Text",
						property: "color",
						value: T.color,
						onChange: he
					}) : null,
					/* @__PURE__ */ B(Nn, {
						label: "Fill",
						property: "background-color",
						value: T.backgroundColor,
						clearable: !0,
						onChange: he
					}),
					/* @__PURE__ */ B(Nn, {
						label: "Border",
						property: "border-color",
						value: T.borderColor,
						onChange: he
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-appearance-measures",
						children: [
							/* @__PURE__ */ B(Pn, {
								label: "Radius",
								value: T.borderRadius,
								step: E,
								suffix: "px",
								onDecrease: () => he("border-radius", `${Math.max(0, T.borderRadius - E)}px`),
								onIncrease: () => he("border-radius", `${T.borderRadius + E}px`)
							}),
							/* @__PURE__ */ B(Pn, {
								label: "Border",
								value: T.borderWidth,
								step: E,
								suffix: "px",
								onDecrease: () => he("border-width", `${Math.max(0, T.borderWidth - E)}px`),
								onIncrease: () => he("border-width", `${T.borderWidth + E}px`)
							}),
							/* @__PURE__ */ B(Pn, {
								label: "Opacity",
								value: T.opacity,
								step: 5,
								suffix: "%",
								onDecrease: () => he("opacity", String(Math.max(0, T.opacity - 5) / 100)),
								onIncrease: () => he("opacity", String(Math.min(100, T.opacity + 5) / 100))
							})
						]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-shadow-control",
						children: [/* @__PURE__ */ B("strong", { children: "Shadow" }), /* @__PURE__ */ B("div", {
							role: "group",
							"aria-label": "Shadow preset",
							children: On.map((e) => /* @__PURE__ */ B("button", {
								className: Rn(T.boxShadow) === e.value ? "active" : "",
								"aria-pressed": Rn(T.boxShadow) === e.value,
								onClick: () => he("box-shadow", e.value),
								children: e.label
							}, e.value))
						})]
					})
				]
			}),
			!u || o ? /* @__PURE__ */ B("span", {
				className: `vt-dimensions ${o ? "dragging" : ""}`,
				style: gt,
				children: o?.kind === "move" ? /* @__PURE__ */ V(z, { children: [
					/* @__PURE__ */ B("strong", { children: "Offset" }),
					/* @__PURE__ */ V("span", { children: ["X ", q(o.x)] }),
					/* @__PURE__ */ V("span", { children: ["Y ", q(o.y)] }),
					o.axis ? /* @__PURE__ */ V("em", { children: [o.axis.toUpperCase(), " axis"] }) : null,
					o.snappingPaused ? /* @__PURE__ */ B("em", { children: "Snap off" }) : null
				] }) : o?.kind === "resize" ? /* @__PURE__ */ V(z, { children: [
					/* @__PURE__ */ B("strong", { children: "Resize" }),
					/* @__PURE__ */ V("span", { children: [
						o.width,
						" × ",
						o.height
					] }),
					o.fontSize === void 0 ? /* @__PURE__ */ V(z, { children: [/* @__PURE__ */ V("span", { children: ["W ", q(o.deltaWidth)] }), /* @__PURE__ */ V("span", { children: ["H ", q(o.deltaHeight)] })] }) : /* @__PURE__ */ V("span", { children: ["Type ", zn(o.fontSize)] }),
					o.ratioLocked ? /* @__PURE__ */ B("em", { children: o.fontSize === void 0 ? "Ratio" : "Text + box" }) : null
				] }) : o?.kind === "type" ? /* @__PURE__ */ V(z, { children: [
					/* @__PURE__ */ B("strong", { children: "Type" }),
					/* @__PURE__ */ B("span", { children: zn(o.fontSize) }),
					/* @__PURE__ */ V("span", { children: ["Size ", zn(o.delta, !0)] })
				] }) : o?.kind === "spacing" ? /* @__PURE__ */ V(z, { children: [
					/* @__PURE__ */ B("strong", { children: "Spacing" }),
					/* @__PURE__ */ V("span", { children: [
						J(o.property),
						" ",
						zn(o.value)
					] }),
					/* @__PURE__ */ V("span", { children: ["Change ", zn(o.delta, !0)] })
				] }) : o?.kind === "appearance" ? /* @__PURE__ */ V(z, { children: [
					/* @__PURE__ */ B("strong", { children: "Style" }),
					/* @__PURE__ */ V("span", { children: [
						Bn(o.property),
						" ",
						Hn(o.property, o.value)
					] }),
					/* @__PURE__ */ B("span", { children: o.delta === void 0 ? `Was ${Hn(o.property, o.previous)}` : `Change ${Un(o.property, o.delta)}` })
				] }) : /* @__PURE__ */ V(z, { children: [
					"X ",
					Math.round(D.x),
					" · Y ",
					Math.round(D.y),
					" · ",
					Math.round(D.width),
					" × ",
					Math.round(D.height)
				] })
			}) : null,
			Ce ? null : En.map((e) => /* @__PURE__ */ B("button", {
				className: `vt-handle vt-handle-${e}`,
				"aria-label": `Resize ${e}`,
				onPointerDown: (t) => r(e, t)
			}, e))
		]
	});
}
//#endregion
//#region src/visual-truth/TextToolbar.tsx
var Gn = [
	["Current font", "inherit"],
	["Arial", "Arial, sans-serif"],
	["Georgia", "Georgia, serif"],
	["Helvetica", "Helvetica, Arial, sans-serif"],
	["Times", "Times New Roman, serif"]
];
function Kn({ element: e, metrics: t, onStyle: n, onStyles: r, onConfirm: i, onCancel: o }) {
	let s = e.getBoundingClientRect(), c = Math.max(12, Math.min(window.innerWidth - 700 - 12, s.left + s.width / 2 - 700 / 2)), l = s.top > 74 ? s.top - 58 : Math.min(window.innerHeight - 58, s.bottom + 10), u = getComputedStyle(e), p = Number.parseInt(u.fontWeight) || (u.fontWeight === "bold" ? 700 : 400);
	return /* @__PURE__ */ V("div", {
		className: "vt-text-toolbar",
		"data-visual-truth-ui": !0,
		role: "toolbar",
		"aria-label": "Text editing tools",
		style: {
			left: c,
			top: l
		},
		children: [
			/* @__PURE__ */ V("select", {
				"aria-label": "Text style",
				value: qn(t.fontSize),
				onChange: (e) => Y(e.target.value, r),
				children: [
					/* @__PURE__ */ B("option", {
						value: "custom",
						children: "Custom"
					}),
					/* @__PURE__ */ B("option", {
						value: "display",
						children: "Display"
					}),
					/* @__PURE__ */ B("option", {
						value: "heading",
						children: "Heading"
					}),
					/* @__PURE__ */ B("option", {
						value: "subheading",
						children: "Subheading"
					}),
					/* @__PURE__ */ B("option", {
						value: "body",
						children: "Body"
					}),
					/* @__PURE__ */ B("option", {
						value: "small",
						children: "Small"
					})
				]
			}),
			/* @__PURE__ */ B("select", {
				"aria-label": "Font family",
				value: "inherit",
				onChange: (e) => n("font-family", e.target.value),
				children: Gn.map(([e, t]) => /* @__PURE__ */ B("option", {
					value: t,
					children: e
				}, t))
			}),
			/* @__PURE__ */ V("div", {
				className: "vt-text-size",
				children: [
					/* @__PURE__ */ B("button", {
						onClick: () => n("font-size", `${Math.max(8, Math.round(t.fontSize) - 1)}px`),
						title: "Decrease text size",
						children: /* @__PURE__ */ B(M, { size: 13 })
					}),
					/* @__PURE__ */ B("input", {
						"aria-label": "Text size",
						type: "number",
						min: "8",
						max: "240",
						value: Math.round(t.fontSize),
						onChange: (e) => n("font-size", `${e.target.value}px`)
					}),
					/* @__PURE__ */ B("button", {
						onClick: () => n("font-size", `${Math.min(240, Math.round(t.fontSize) + 1)}px`),
						title: "Increase text size",
						children: /* @__PURE__ */ B(Ze, { size: 13 })
					})
				]
			}),
			/* @__PURE__ */ B("i", {}),
			/* @__PURE__ */ B("button", {
				className: p >= 600 ? "active" : "",
				onClick: () => n("font-weight", p >= 600 ? "400" : "700"),
				title: "Bold",
				children: /* @__PURE__ */ B(b, { size: 15 })
			}),
			/* @__PURE__ */ B("button", {
				className: u.fontStyle === "italic" ? "active" : "",
				onClick: () => n("font-style", u.fontStyle === "italic" ? "normal" : "italic"),
				title: "Italic",
				children: /* @__PURE__ */ B(Ie, { size: 15 })
			}),
			/* @__PURE__ */ B("button", {
				className: u.textDecorationLine.includes("underline") ? "active" : "",
				onClick: () => n("text-decoration", u.textDecorationLine.includes("underline") ? "none" : "underline"),
				title: "Underline",
				children: /* @__PURE__ */ B(gt, { size: 15 })
			}),
			/* @__PURE__ */ B("label", {
				className: "vt-inline-color",
				title: "Text color",
				children: /* @__PURE__ */ B("input", {
					"aria-label": "Text color",
					type: "color",
					value: Jn(t.color),
					onChange: (e) => n("color", e.target.value)
				})
			}),
			/* @__PURE__ */ B("i", {}),
			/* @__PURE__ */ B("button", {
				className: t.textAlign === "left" || t.textAlign === "start" ? "active" : "",
				onClick: () => n("text-align", "left"),
				title: "Align left",
				children: /* @__PURE__ */ B(d, { size: 15 })
			}),
			/* @__PURE__ */ B("button", {
				className: t.textAlign === "center" ? "active" : "",
				onClick: () => n("text-align", "center"),
				title: "Align center",
				children: /* @__PURE__ */ B(a, { size: 15 })
			}),
			/* @__PURE__ */ B("button", {
				className: t.textAlign === "right" || t.textAlign === "end" ? "active" : "",
				onClick: () => n("text-align", "right"),
				title: "Align right",
				children: /* @__PURE__ */ B(f, { size: 15 })
			}),
			/* @__PURE__ */ B("i", {}),
			/* @__PURE__ */ B("button", {
				className: "vt-text-cancel",
				onClick: o,
				title: "Cancel text changes",
				children: /* @__PURE__ */ B(bt, { size: 16 })
			}),
			/* @__PURE__ */ B("button", {
				className: "vt-text-confirm",
				onClick: i,
				title: "Keep text changes",
				children: /* @__PURE__ */ B(ie, { size: 16 })
			})
		]
	});
}
function qn(e) {
	return e === 72 ? "display" : e === 48 ? "heading" : e === 28 ? "subheading" : e === 16 ? "body" : e === 13 ? "small" : "custom";
}
function Y(e, t) {
	let n = {
		display: [
			"72px",
			"1.05",
			"700"
		],
		heading: [
			"48px",
			"1.1",
			"700"
		],
		subheading: [
			"28px",
			"1.2",
			"600"
		],
		body: [
			"16px",
			"1.5",
			"400"
		],
		small: [
			"13px",
			"1.45",
			"400"
		]
	}[e];
	n && t({
		"font-size": n[0],
		"line-height": n[1],
		"font-weight": n[2]
	});
}
function Jn(e) {
	let t = e.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
	return !t || t.length < 3 ? e.startsWith("#") ? e : "#ffffff" : `#${t.map((e) => Math.round(e).toString(16).padStart(2, "0")).join("")}`;
}
//#endregion
//#region src/visual-truth/MultiSelectionOverlay.tsx
function Yn({ elements: e, revision: t, grouped: n, onMoveStart: r, onAlign: i, onDistribute: a, onGroup: u, onUngroup: d }) {
	let f = e.filter((e) => document.contains(e)).map((e) => e.getBoundingClientRect());
	if (f.length < 2) return null;
	let te = Math.min(...f.map((e) => e.left)), g = Math.min(...f.map((e) => e.top)), _ = Math.max(...f.map((e) => e.right)), v = Math.max(...f.map((e) => e.bottom)), y = document.querySelector(".vt-layers, .vt-elements")?.getBoundingClientRect(), b = document.querySelector(".vt-studio, .vt-inspector")?.getBoundingClientRect(), ne = document.querySelector(".vt-toolbar")?.getBoundingClientRect(), re = document.querySelector(".vt-statusbar")?.getBoundingClientRect(), ie = document.querySelector(".vt-ruler-vertical")?.getBoundingClientRect(), ae = document.querySelector(".vt-ruler-horizontal")?.getBoundingClientRect(), oe = Math.max(y?.width ? y.right + 8 : 8, ie?.width ? ie.right + 8 : 8), se = b?.width ? b.left - 8 : window.innerWidth - 8, ce = Math.max(ne?.height ? ne.bottom + 8 : 8, ae?.height ? ae.bottom + 8 : 8), x = re?.height ? re.top - 8 : window.innerHeight - 8, S = g - 45, le = S >= ce ? S : v + 42 <= x ? v + 8 : ce, ue = Math.max(oe, Math.min(te - 13, se - 26)), de = Math.max(ce, Math.min(g - 13, x - 26));
	return /* @__PURE__ */ V(z, { children: [
		f.map((t, n) => /* @__PURE__ */ B("div", {
			className: "vt-multi-item-outline",
			style: {
				left: t.left,
				top: t.top,
				width: t.width,
				height: t.height
			}
		}, `${e[n]?.dataset.vtId ?? n}`)),
		/* @__PURE__ */ B("div", {
			className: "vt-multi-selection",
			"data-visual-truth-ui": !0,
			style: {
				left: te,
				top: g,
				width: _ - te,
				height: v - g
			},
			children: /* @__PURE__ */ B("button", {
				className: "vt-multi-move",
				style: {
					left: ue,
					top: de
				},
				"aria-label": "Move selected elements together",
				title: "Move selected elements together",
				onPointerDown: r,
				children: /* @__PURE__ */ B(P, { size: 13 })
			})
		}),
		/* @__PURE__ */ B("div", {
			className: "vt-multi-toolbar-anchor",
			"data-visual-truth-ui": !0,
			style: {
				left: oe,
				top: le,
				width: Math.max(0, se - oe)
			},
			children: /* @__PURE__ */ V("div", {
				className: "vt-multi-toolbar",
				role: "toolbar",
				"aria-label": "Arrange selected elements",
				children: [
					/* @__PURE__ */ V("strong", { children: [e.length, " selected"] }),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Align selected elements left",
						title: "Align left",
						onClick: () => i("horizontal", "start"),
						children: /* @__PURE__ */ B(l, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Align selected elements horizontally",
						title: "Center horizontally",
						onClick: () => i("horizontal", "center"),
						children: /* @__PURE__ */ B(s, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Align selected elements right",
						title: "Align right",
						onClick: () => i("horizontal", "end"),
						children: /* @__PURE__ */ B(c, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Distribute selected elements horizontally",
						title: "Distribute horizontally",
						onClick: () => a("horizontal"),
						children: /* @__PURE__ */ B(o, { size: 14 })
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Align selected elements top",
						title: "Align top",
						onClick: () => i("vertical", "start"),
						children: /* @__PURE__ */ B(h, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Align selected elements vertically",
						title: "Center vertically",
						onClick: () => i("vertical", "center"),
						children: /* @__PURE__ */ B(m, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Align selected elements bottom",
						title: "Align bottom",
						onClick: () => i("vertical", "end"),
						children: /* @__PURE__ */ B(ee, { size: 14 })
					}),
					/* @__PURE__ */ B("button", {
						"aria-label": "Distribute selected elements vertically",
						title: "Distribute vertically",
						onClick: () => a("vertical"),
						children: /* @__PURE__ */ B(p, { size: 14 })
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B("button", {
						"aria-label": n ? "Ungroup selected elements" : "Group selected elements",
						title: n ? "Ungroup" : "Group",
						onClick: n ? d : u,
						children: B(n ? vt : je, { size: 14 })
					})
				]
			})
		})
	] });
}
//#endregion
//#region src/visual-truth/CanvasRulers.tsx
function Xn(e, t, n) {
	let r = Math.floor(e / n) * n, i = [];
	for (let a = r; a <= e + t + n; a += n) i.push(a);
	return i;
}
function Zn() {
	return document.querySelector("[data-vt-workspace-canvas=\"true\"]") ?? document.querySelector(".vt-root")?.parentElement;
}
function Qn({ unit: e, guides: n, onUnitChange: r, onGuidesChange: a }) {
	let [o, s] = i(() => ({
		scrollLeft: 0,
		scrollTop: 0,
		scrollWidth: typeof window > "u" ? 0 : window.innerWidth,
		scrollHeight: typeof window > "u" ? 0 : window.innerHeight,
		left: 0,
		top: 0,
		width: typeof window > "u" ? 0 : window.innerWidth,
		height: typeof window > "u" ? 0 : window.innerHeight
	})), [c, l] = i(null), [u, d] = i(n.length === 0);
	t(() => {
		let e = Zn();
		if (!e) return;
		let t = 0, n = () => {
			window.cancelAnimationFrame(t), t = window.requestAnimationFrame(() => {
				let t = e.getBoundingClientRect();
				s({
					scrollLeft: e.scrollLeft,
					scrollTop: e.scrollTop,
					scrollWidth: e.scrollWidth,
					scrollHeight: e.scrollHeight,
					left: t.left,
					top: t.top,
					width: e.clientWidth,
					height: e.clientHeight
				});
			});
		}, r = new ResizeObserver(n);
		return r.observe(e), e.addEventListener("scroll", n, { passive: !0 }), window.addEventListener("resize", n), n(), () => {
			window.cancelAnimationFrame(t), r.disconnect(), e.removeEventListener("scroll", n), window.removeEventListener("resize", n);
		};
	}, []), t(() => {
		if (n.length) return;
		let e = window.setTimeout(() => d(!1), 6500);
		return () => window.clearTimeout(e);
	}, [n.length]);
	let f = e === "px" ? 100 : 96, p = e === "px" ? 50 : 48, m = e === "px" ? 10 : 12, ee = {
		"--vt-ruler-major": `${f}px`,
		"--vt-ruler-medium": `${p}px`,
		"--vt-ruler-minor": `${m}px`,
		"--vt-ruler-x-offset": `${-(o.scrollLeft % f)}px`,
		"--vt-ruler-y-offset": `${-(o.scrollTop % f)}px`
	}, h = (t) => String(e === "px" ? Math.round(t) : Math.round(t / 96 * 100) / 100), te = (e, t, r) => {
		if (t.button !== 0) return;
		t.preventDefault(), t.stopPropagation();
		let i = Zn();
		if (!i) return;
		let o = (t) => {
			let n = i.getBoundingClientRect(), r = e === "x" ? t.clientX - n.left + i.scrollLeft : t.clientY - n.top + i.scrollTop, a = e === "x" ? i.scrollWidth : i.scrollHeight;
			return Math.max(0, Math.min(a, Math.round(r)));
		};
		l({
			axis: e,
			position: r?.position ?? o(t),
			id: r?.id
		});
		let s = (t) => l({
			axis: e,
			position: o(t),
			id: r?.id
		}), c = (t) => {
			let d = i.getBoundingClientRect(), f = t.clientX >= d.left && t.clientX <= d.right && t.clientY >= d.top && t.clientY <= d.bottom, p = o(t);
			f ? a(r ? n.map((e) => e.id === r.id ? {
				...e,
				position: p
			} : e) : [...n, {
				id: crypto.randomUUID(),
				axis: e,
				position: p
			}]) : r && a(n.filter((e) => e.id !== r.id)), l(null), window.removeEventListener("pointermove", s), window.removeEventListener("pointerup", c), window.removeEventListener("pointercancel", u);
		}, u = () => {
			l(null), window.removeEventListener("pointermove", s), window.removeEventListener("pointerup", c), window.removeEventListener("pointercancel", u);
		};
		window.addEventListener("pointermove", s), window.addEventListener("pointerup", c), window.addEventListener("pointercancel", u);
	}, g = (e, t) => {
		if (t.key === "Delete" || t.key === "Backspace") {
			t.preventDefault(), a(n.filter((t) => t.id !== e.id));
			return;
		}
		let r = e.axis === "x" ? t.key === "ArrowLeft" ? -1 : +(t.key === "ArrowRight") : t.key === "ArrowUp" ? -1 : +(t.key === "ArrowDown");
		if (!r) return;
		t.preventDefault();
		let i = e.axis === "x" ? o.scrollWidth : o.scrollHeight, s = t.shiftKey ? 10 : 1;
		a(n.map((t) => t.id === e.id ? {
			...t,
			position: Math.max(0, Math.min(i, t.position + r * s))
		} : t));
	}, _ = (t, r = !1) => {
		let i = t.axis === "x" ? o.left + t.position - o.scrollLeft : o.top + t.position - o.scrollTop, s = t.axis === "x" ? {
			left: i,
			top: o.top,
			height: o.height
		} : {
			top: i,
			left: o.left,
			width: o.width
		};
		return /* @__PURE__ */ B("button", {
			className: `vt-ruler-guide ${t.axis === "x" ? "vertical" : "horizontal"}${r ? " dragging" : ""}`,
			style: s,
			"aria-label": `${t.axis === "x" ? "Vertical" : "Horizontal"} guide at ${h(t.position)} ${e === "px" ? "pixels" : "inches"}`,
			title: `${h(t.position)} ${e} · Drag to move · Double-click or press Delete to remove`,
			tabIndex: r ? -1 : 0,
			onPointerDown: r ? void 0 : (e) => te(t.axis, e, t),
			onKeyDown: r ? void 0 : (e) => g(t, e),
			onDoubleClick: r ? void 0 : () => a(n.filter((e) => e.id !== t.id)),
			onContextMenu: r ? void 0 : (e) => {
				e.preventDefault(), a(n.filter((e) => e.id !== t.id));
			},
			children: /* @__PURE__ */ V("span", {
				className: "vt-ruler-guide-value",
				children: [h(t.position), e]
			})
		}, `${r ? "preview" : "guide"}-${t.id}`);
	};
	return /* @__PURE__ */ V("div", {
		className: "vt-rulers",
		"data-visual-truth-ui": !0,
		style: ee,
		children: [
			/* @__PURE__ */ B("button", {
				className: "vt-ruler-corner",
				title: `Rulers use ${e === "px" ? "pixels" : "inches"}. Click to switch. Right-click to clear ${n.length} guides.`,
				"aria-label": `Rulers use ${e === "px" ? "pixels" : "inches"}. Click to switch units. Right-click to clear all guides.`,
				onClick: () => r(e === "px" ? "in" : "px"),
				onContextMenu: (e) => {
					e.preventDefault(), a([]);
				},
				children: e
			}),
			/* @__PURE__ */ B("div", {
				className: "vt-ruler vt-ruler-horizontal",
				"aria-label": `Horizontal ruler in ${e === "px" ? "pixels" : "inches"}. Drag down to add a horizontal guide.`,
				onPointerDown: (e) => te("y", e),
				children: Xn(o.scrollLeft, o.width, f).map((e) => /* @__PURE__ */ B("span", {
					style: { left: e - o.scrollLeft + 3 },
					children: h(e)
				}, e))
			}),
			/* @__PURE__ */ B("div", {
				className: "vt-ruler vt-ruler-vertical",
				"aria-label": `Vertical ruler in ${e === "px" ? "pixels" : "inches"}. Drag right to add a vertical guide.`,
				onPointerDown: (e) => te("x", e),
				children: Xn(o.scrollTop, o.height, f).map((e) => /* @__PURE__ */ B("span", {
					style: { top: e - o.scrollTop + 3 },
					children: h(e)
				}, e))
			}),
			n.filter((e) => e.id !== c?.id).map((e) => _(e)),
			c ? _({
				id: c.id ?? "new",
				axis: c.axis,
				position: c.position
			}, !0) : null,
			u && !n.length ? /* @__PURE__ */ V("div", {
				className: "vt-ruler-hint",
				role: "status",
				children: [/* @__PURE__ */ B("strong", { children: "Precision guides" }), /* @__PURE__ */ B("span", { children: "Drag from either ruler onto the canvas" })]
			}) : null
		]
	});
}
//#endregion
//#region src/visual-truth/StudioPanel.tsx
function X({ title: e, icon: t, defaultOpen: n = !0, children: r }) {
	let [a, o] = i(n);
	return /* @__PURE__ */ V("section", {
		className: `vt-studio-section${a ? " open" : ""}`,
		children: [/* @__PURE__ */ V("button", {
			className: "vt-studio-heading",
			"aria-expanded": a,
			onClick: () => o((e) => !e),
			children: [/* @__PURE__ */ V("span", { children: [t, /* @__PURE__ */ B("strong", { children: e })] }), /* @__PURE__ */ B(oe, { size: 14 })]
		}), a ? /* @__PURE__ */ B("div", {
			className: "vt-studio-content",
			children: r
		}) : null]
	});
}
var $n = JSON.stringify([{
	name: "First card",
	description: "Edit this data and bind fields visually."
}, {
	name: "Second card",
	description: "Every row becomes another card."
}], null, 2);
function er(e) {
	let [t, n] = i(""), [r, a] = i(""), [u, d] = i("Card list"), [f, te] = i("name"), [g, _] = i("text"), [v, y] = i(() => e.activeRepeater ? JSON.stringify(e.activeRepeater.data, null, 2) : $n), [b, ne] = i(""), re = () => {
		try {
			let e = JSON.parse(v);
			if (!Array.isArray(e) || e.some((e) => !e || typeof e != "object" || Array.isArray(e))) throw Error("Use a JSON array of objects.");
			return ne(""), e;
		} catch (e) {
			return ne(e instanceof Error ? e.message : "Use valid JSON data."), null;
		}
	};
	return /* @__PURE__ */ V("aside", {
		className: "vt-studio",
		"data-visual-truth-ui": !0,
		children: [/* @__PURE__ */ V("header", {
			className: "vt-studio-header",
			children: [/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: "Studio" }), /* @__PURE__ */ B("span", { children: "Advanced visual tools" })] }), /* @__PURE__ */ B("button", {
				"aria-label": "Close Studio",
				title: "Close Studio",
				onClick: e.onClose,
				children: /* @__PURE__ */ B(bt, { size: 15 })
			})]
		}), /* @__PURE__ */ V("div", {
			className: "vt-studio-scroll",
			children: [
				/* @__PURE__ */ V(X, {
					title: "Arrange",
					icon: /* @__PURE__ */ B(je, { size: 14 }),
					children: [
						/* @__PURE__ */ B("p", {
							className: "vt-studio-help",
							children: "Shift-click elements to select several. Drag the blue group handle or arrange them together."
						}),
						/* @__PURE__ */ V("div", {
							className: "vt-studio-selection-status",
							children: [/* @__PURE__ */ B("strong", { children: e.selectedCount }), /* @__PURE__ */ B("span", { children: e.selectedCount === 1 ? "element selected" : "elements selected" })]
						}),
						/* @__PURE__ */ V("div", {
							className: "vt-arrange-grid",
							role: "group",
							"aria-label": "Align selected elements",
							children: [
								/* @__PURE__ */ B("button", {
									disabled: e.selectedCount < 2,
									title: "Align left",
									onClick: () => e.onAlignSelection("horizontal", "start"),
									children: /* @__PURE__ */ B(l, { size: 15 })
								}),
								/* @__PURE__ */ B("button", {
									disabled: e.selectedCount < 2,
									title: "Center horizontally",
									onClick: () => e.onAlignSelection("horizontal", "center"),
									children: /* @__PURE__ */ B(s, { size: 15 })
								}),
								/* @__PURE__ */ B("button", {
									disabled: e.selectedCount < 2,
									title: "Align right",
									onClick: () => e.onAlignSelection("horizontal", "end"),
									children: /* @__PURE__ */ B(c, { size: 15 })
								}),
								/* @__PURE__ */ B("button", {
									disabled: e.selectedCount < 3,
									title: "Distribute horizontally",
									onClick: () => e.onDistributeSelection("horizontal"),
									children: /* @__PURE__ */ B(o, { size: 15 })
								}),
								/* @__PURE__ */ B("button", {
									disabled: e.selectedCount < 2,
									title: "Align top",
									onClick: () => e.onAlignSelection("vertical", "start"),
									children: /* @__PURE__ */ B(h, { size: 15 })
								}),
								/* @__PURE__ */ B("button", {
									disabled: e.selectedCount < 2,
									title: "Center vertically",
									onClick: () => e.onAlignSelection("vertical", "center"),
									children: /* @__PURE__ */ B(m, { size: 15 })
								}),
								/* @__PURE__ */ B("button", {
									disabled: e.selectedCount < 2,
									title: "Align bottom",
									onClick: () => e.onAlignSelection("vertical", "end"),
									children: /* @__PURE__ */ B(ee, { size: 15 })
								}),
								/* @__PURE__ */ B("button", {
									disabled: e.selectedCount < 3,
									title: "Distribute vertically",
									onClick: () => e.onDistributeSelection("vertical"),
									children: /* @__PURE__ */ B(p, { size: 15 })
								})
							]
						}),
						/* @__PURE__ */ V("button", {
							className: "vt-studio-primary",
							disabled: e.selectedCount < 2,
							onClick: e.grouped ? e.onUngroupSelection : e.onGroupSelection,
							children: [e.grouped ? /* @__PURE__ */ B(vt, { size: 14 }) : /* @__PURE__ */ B(je, { size: 14 }), e.grouped ? "Ungroup" : "Group selection"]
						})
					]
				}),
				/* @__PURE__ */ V(X, {
					title: "Grid & snapping",
					icon: /* @__PURE__ */ B(ke, { size: 14 }),
					children: [
						/* @__PURE__ */ V("label", {
							className: "vt-studio-toggle",
							children: [
								/* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: "Show grid" }), /* @__PURE__ */ B("small", { children: "Visible alignment grid" })] }),
								/* @__PURE__ */ B("input", {
									type: "checkbox",
									checked: e.gridVisible,
									onChange: (t) => e.onGridVisible(t.target.checked)
								}),
								/* @__PURE__ */ B("i", {})
							]
						}),
						/* @__PURE__ */ V("label", {
							className: "vt-studio-toggle",
							children: [
								/* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: "Show rulers" }), /* @__PURE__ */ B("small", { children: "X and Y canvas measurements" })] }),
								/* @__PURE__ */ B("input", {
									type: "checkbox",
									checked: e.rulersVisible,
									onChange: (t) => e.onRulersVisible(t.target.checked)
								}),
								/* @__PURE__ */ B("i", {})
							]
						}),
						/* @__PURE__ */ V("div", {
							className: "vt-ruler-unit",
							role: "group",
							"aria-label": "Ruler units",
							children: [/* @__PURE__ */ B("button", {
								className: e.rulerUnit === "px" ? "active" : "",
								"aria-pressed": e.rulerUnit === "px",
								onClick: () => e.onRulerUnit("px"),
								children: "Pixels"
							}), /* @__PURE__ */ B("button", {
								className: e.rulerUnit === "in" ? "active" : "",
								"aria-pressed": e.rulerUnit === "in",
								onClick: () => e.onRulerUnit("in"),
								children: "Inches"
							})]
						}),
						/* @__PURE__ */ V("div", {
							className: "vt-guide-summary",
							children: [
								/* @__PURE__ */ B("span", { children: /* @__PURE__ */ B(ye, { size: 14 }) }),
								/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: "Ruler guides" }), /* @__PURE__ */ B("small", { children: "Drag from the rulers onto the canvas" })] }),
								/* @__PURE__ */ B("b", { children: e.rulerGuides.length })
							]
						}),
						e.rulerGuides.length ? /* @__PURE__ */ V("div", {
							className: "vt-guide-list",
							children: [e.rulerGuides.map((t, n) => {
								let r = e.rulerUnit === "px" ? Math.round(t.position) : Math.round(t.position / 96 * 100) / 100;
								return /* @__PURE__ */ V("label", { children: [
									/* @__PURE__ */ V("span", { children: [t.axis === "x" ? "V" : "H", n + 1] }),
									/* @__PURE__ */ B("input", {
										"aria-label": `${t.axis === "x" ? "Vertical" : "Horizontal"} guide position`,
										type: "number",
										min: "0",
										step: e.rulerUnit === "px" ? 1 : .01,
										value: r,
										onChange: (n) => {
											let r = Number(n.target.value);
											if (!Number.isFinite(r)) return;
											let i = Math.max(0, e.rulerUnit === "px" ? r : r * 96);
											e.onRulerGuidesChange(e.rulerGuides.map((e) => e.id === t.id ? {
												...e,
												position: i
											} : e));
										}
									}),
									/* @__PURE__ */ B("em", { children: e.rulerUnit }),
									/* @__PURE__ */ B("button", {
										"aria-label": `Delete ${t.axis === "x" ? "vertical" : "horizontal"} guide ${n + 1}`,
										onClick: () => e.onRulerGuidesChange(e.rulerGuides.filter((e) => e.id !== t.id)),
										children: /* @__PURE__ */ B(mt, { size: 11 })
									})
								] }, t.id);
							}), /* @__PURE__ */ V("button", {
								className: "vt-clear-guides",
								onClick: () => e.onRulerGuidesChange([]),
								children: [/* @__PURE__ */ B(mt, { size: 12 }), "Clear all guides"]
							})]
						}) : null,
						/* @__PURE__ */ V("label", {
							className: "vt-studio-toggle",
							children: [
								/* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: "Magnetic guides" }), /* @__PURE__ */ B("small", { children: "Edges and centers" })] }),
								/* @__PURE__ */ B("input", {
									type: "checkbox",
									checked: e.snappingEnabled,
									onChange: (t) => e.onSnappingEnabled(t.target.checked)
								}),
								/* @__PURE__ */ B("i", {})
							]
						}),
						/* @__PURE__ */ V("label", {
							className: "vt-studio-toggle",
							children: [
								/* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: "Snap to grid" }), /* @__PURE__ */ B("small", { children: "Land on exact increments" })] }),
								/* @__PURE__ */ B("input", {
									type: "checkbox",
									checked: e.snapToGrid,
									onChange: (t) => e.onSnapToGrid(t.target.checked)
								}),
								/* @__PURE__ */ B("i", {})
							]
						}),
						/* @__PURE__ */ B("div", {
							className: "vt-grid-size",
							role: "group",
							"aria-label": "Grid size",
							children: [
								4,
								8,
								12,
								16
							].map((t) => /* @__PURE__ */ V("button", {
								className: e.gridSize === t ? "active" : "",
								"aria-pressed": e.gridSize === t,
								onClick: () => e.onGridSize(t),
								children: [t, "px"]
							}, t))
						})
					]
				}),
				/* @__PURE__ */ V(X, {
					title: "Responsive truth",
					icon: /* @__PURE__ */ B($e, { size: 14 }),
					defaultOpen: !1,
					children: [/* @__PURE__ */ B("p", {
						className: "vt-studio-help",
						children: "Muted values use the project's source styles. Blue values are explicit device overrides."
					}), [
						"desktop",
						"tablet",
						"phone"
					].map((t) => /* @__PURE__ */ V("div", {
						className: "vt-inheritance-device",
						children: [/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B("strong", { children: t === "tablet" ? "iPad" : `${t[0].toUpperCase()}${t.slice(1)}` }), /* @__PURE__ */ V("span", { children: [e.responsiveOverrides[t].size, " overrides"] })] }), e.responsiveOverrides[t].size ? /* @__PURE__ */ B("ul", { children: [...e.responsiveOverrides[t]].map((n) => /* @__PURE__ */ V("li", { children: [/* @__PURE__ */ B("code", { children: n }), /* @__PURE__ */ B("button", {
							title: `Reset ${n} on ${t}`,
							onClick: () => e.onResetResponsiveProperty(t, n),
							children: /* @__PURE__ */ B(et, { size: 11 })
						})] }, n)) }) : /* @__PURE__ */ B("p", { children: "Using source styles with no device override." })]
					}, t))]
				}),
				/* @__PURE__ */ V(X, {
					title: "Reusable sections",
					icon: /* @__PURE__ */ B(Be, { size: 14 }),
					defaultOpen: !1,
					children: [/* @__PURE__ */ V("div", {
						className: "vt-studio-create",
						children: [
							/* @__PURE__ */ B("input", {
								value: t,
								onChange: (e) => n(e.target.value),
								placeholder: "Section name"
							}),
							/* @__PURE__ */ B("button", {
								disabled: !e.selected,
								title: "Save selected section",
								onClick: () => {
									e.onSaveSection(t), n("");
								},
								children: /* @__PURE__ */ B(tt, { size: 13 })
							}),
							/* @__PURE__ */ B("button", {
								title: "Import section from clipboard",
								onClick: e.onImportSection,
								children: /* @__PURE__ */ B(de, { size: 13 })
							})
						]
					}), e.sections.length ? /* @__PURE__ */ B("ul", {
						className: "vt-library-list",
						children: e.sections.map((t) => /* @__PURE__ */ V("li", { children: [/* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: t.name }), /* @__PURE__ */ B("small", { children: new Date(t.createdAt).toLocaleDateString() })] }), /* @__PURE__ */ V("div", { children: [
							/* @__PURE__ */ B("button", {
								title: "Insert section",
								onClick: () => e.onInsertSection(t),
								children: /* @__PURE__ */ B(he, { size: 12 })
							}),
							/* @__PURE__ */ B("button", {
								title: "Copy section for another project",
								onClick: () => e.onCopySection(t),
								children: /* @__PURE__ */ B(ue, { size: 12 })
							}),
							/* @__PURE__ */ B("button", {
								title: "Delete section",
								onClick: () => e.onDeleteSection(t.id),
								children: /* @__PURE__ */ B(mt, { size: 12 })
							})
						] })] }, t.id))
					}) : /* @__PURE__ */ B("p", {
						className: "vt-studio-empty",
						children: "Select a hero, card, or section and save it here."
					})]
				}),
				/* @__PURE__ */ V(X, {
					title: "Named styles",
					icon: /* @__PURE__ */ B(I, { size: 14 }),
					defaultOpen: !1,
					children: [/* @__PURE__ */ V("div", {
						className: "vt-studio-create",
						children: [/* @__PURE__ */ B("input", {
							value: r,
							onChange: (e) => a(e.target.value),
							placeholder: "Style name"
						}), /* @__PURE__ */ B("button", {
							disabled: !e.selected,
							title: "Create style from selection",
							onClick: () => {
								e.onCreateNamedStyle(r), a("");
							},
							children: /* @__PURE__ */ B(Ze, { size: 13 })
						})]
					}), e.namedStyles.length ? /* @__PURE__ */ B("ul", {
						className: "vt-library-list",
						children: e.namedStyles.map((t) => /* @__PURE__ */ V("li", { children: [/* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: t.name }), /* @__PURE__ */ V("small", { children: [Object.keys(t.properties).length, " properties"] })] }), /* @__PURE__ */ V("div", { children: [
							/* @__PURE__ */ B("button", {
								disabled: !e.selected,
								title: "Apply style",
								onClick: () => e.onApplyNamedStyle(t),
								children: /* @__PURE__ */ B(ie, { size: 12 })
							}),
							/* @__PURE__ */ B("button", {
								disabled: !e.selected,
								title: "Update style and all linked elements",
								onClick: () => e.onUpdateNamedStyle(t),
								children: /* @__PURE__ */ B($e, { size: 12 })
							}),
							/* @__PURE__ */ B("button", {
								title: "Delete style",
								onClick: () => e.onDeleteNamedStyle(t.id),
								children: /* @__PURE__ */ B(mt, { size: 12 })
							})
						] })] }, t.id))
					}) : /* @__PURE__ */ B("p", {
						className: "vt-studio-empty",
						children: "Create reusable typography, button, card, or layout styles."
					})]
				}),
				/* @__PURE__ */ B(X, {
					title: "Repeated cards & data",
					icon: /* @__PURE__ */ B(be, { size: 14 }),
					defaultOpen: !1,
					children: e.activeRepeater ? /* @__PURE__ */ V(z, { children: [
						/* @__PURE__ */ V("div", {
							className: "vt-repeater-summary",
							children: [/* @__PURE__ */ B("strong", { children: e.activeRepeater.name }), /* @__PURE__ */ V("span", { children: [
								e.activeRepeater.data.length,
								" rows · ",
								e.activeRepeater.bindings.length,
								" bindings"
							] })]
						}),
						/* @__PURE__ */ B("p", {
							className: "vt-studio-help",
							children: "Select text or an image inside the template, choose a field, then bind it."
						}),
						/* @__PURE__ */ V("div", {
							className: "vt-binding-row",
							children: [
								/* @__PURE__ */ B("input", {
									value: f,
									onChange: (e) => te(e.target.value),
									placeholder: "Field name"
								}),
								/* @__PURE__ */ V("select", {
									value: g,
									onChange: (e) => _(e.target.value),
									children: [
										/* @__PURE__ */ B("option", {
											value: "text",
											children: "Text"
										}),
										/* @__PURE__ */ B("option", {
											value: "src",
											children: "Image source"
										}),
										/* @__PURE__ */ B("option", {
											value: "href",
											children: "Link"
										}),
										/* @__PURE__ */ B("option", {
											value: "background-image",
											children: "Background"
										})
									]
								}),
								/* @__PURE__ */ B("button", {
									disabled: !e.selected || !f.trim(),
									onClick: () => e.onBindRepeater(f.trim(), g),
									children: /* @__PURE__ */ B(Ze, { size: 13 })
								})
							]
						}),
						/* @__PURE__ */ B("ul", {
							className: "vt-binding-list",
							children: e.activeRepeater.bindings.map((e) => /* @__PURE__ */ V("li", { children: [/* @__PURE__ */ B("code", { children: e.field }), /* @__PURE__ */ B("span", { children: e.target })] }, `${e.selector}:${e.target}`))
						}),
						/* @__PURE__ */ V("label", {
							className: "vt-studio-field",
							children: [/* @__PURE__ */ B("span", { children: "Data" }), /* @__PURE__ */ B("textarea", {
								value: v,
								onChange: (e) => y(e.target.value)
							})]
						}),
						b ? /* @__PURE__ */ B("p", {
							className: "vt-studio-error",
							children: b
						}) : null,
						/* @__PURE__ */ V("div", {
							className: "vt-studio-actions",
							children: [
								/* @__PURE__ */ V("button", {
									onClick: () => {
										let t = re();
										t && e.onUpdateRepeaterData(t);
									},
									children: [/* @__PURE__ */ B(yt, { size: 13 }), "Update data"]
								}),
								/* @__PURE__ */ V("button", {
									className: "primary",
									disabled: !e.activeRepeater.bindings.length,
									onClick: e.onRenderRepeater,
									children: [/* @__PURE__ */ B($e, { size: 13 }), "Render cards"]
								}),
								/* @__PURE__ */ B("button", {
									className: "danger",
									onClick: e.onDeleteRepeater,
									children: /* @__PURE__ */ B(mt, { size: 13 })
								})
							]
						})
					] }) : /* @__PURE__ */ V(z, { children: [
						/* @__PURE__ */ V("label", {
							className: "vt-studio-field",
							children: [/* @__PURE__ */ B("span", { children: "Repeater name" }), /* @__PURE__ */ B("input", {
								value: u,
								onChange: (e) => d(e.target.value)
							})]
						}),
						/* @__PURE__ */ V("label", {
							className: "vt-studio-field",
							children: [/* @__PURE__ */ B("span", { children: "Data" }), /* @__PURE__ */ B("textarea", {
								value: v,
								onChange: (e) => y(e.target.value)
							})]
						}),
						b ? /* @__PURE__ */ B("p", {
							className: "vt-studio-error",
							children: b
						}) : null,
						/* @__PURE__ */ V("button", {
							className: "vt-studio-primary",
							disabled: !e.selected,
							onClick: () => {
								let t = re();
								t && e.onCreateRepeater(u, t);
							},
							children: [/* @__PURE__ */ B(be, { size: 14 }), "Use selected element as template"]
						})
					] })
				}),
				/* @__PURE__ */ V(X, {
					title: "Make It Code",
					icon: /* @__PURE__ */ B(w, { size: 14 }),
					children: [
						/* @__PURE__ */ B("p", {
							className: "vt-studio-help",
							children: "Write the current visual changes into a generated source file in this project. The file is reviewable, reversible, and included in normal builds."
						}),
						/* @__PURE__ */ V("div", {
							className: `vt-code-bridge ${e.makeCodeState.status}`,
							children: [/* @__PURE__ */ B("span", { children: e.makeCodeState.status === "saved" ? /* @__PURE__ */ B(ie, { size: 14 }) : /* @__PURE__ */ B(w, { size: 14 }) }), /* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: e.makeCodeState.status === "saved" ? "Saved to source" : e.makeCodeState.status === "error" ? "Source bridge unavailable" : "Local source bridge" }), /* @__PURE__ */ B("small", { children: e.makeCodeState.file || e.makeCodeState.message || `${e.changeCount} captured changes ready` })] })]
						}),
						/* @__PURE__ */ V("button", {
							className: "vt-make-code",
							disabled: !e.changeCount || e.makeCodeState.status === "saving",
							onClick: e.onMakeItCode,
							children: [e.makeCodeState.status === "saving" ? /* @__PURE__ */ B($e, {
								className: "spin",
								size: 15
							}) : /* @__PURE__ */ B(xe, { size: 15 }), e.makeCodeState.status === "saving" ? "Writing source..." : "Make It Code"]
						})
					]
				})
			]
		})]
	});
}
//#endregion
//#region src/visual-truth/elements.ts
var Z = "main, section, article, header, footer, nav, aside, div, form, ul, ol";
function tr(e) {
	let t = document.querySelector("[data-vt-label=\"Page\"]") ?? document.querySelector("main") ?? document.body;
	return !e || !document.contains(e) ? {
		parent: t,
		index: t.children.length,
		placement: "inside"
	} : e.matches(Z) ? {
		parent: e,
		index: e.children.length,
		placement: "inside"
	} : {
		parent: e.parentElement ?? t,
		index: sr(e) + 1,
		placement: "after"
	};
}
function nr(e) {
	if (e === "heading") {
		let e = Q(document.createElement("h2"), "New heading");
		return e.textContent = "A clear new heading", $(e, {
			margin: "0",
			color: "#17191d",
			fontSize: "40px",
			fontWeight: "700",
			lineHeight: "1.15"
		}), e;
	}
	if (e === "text") {
		let e = Q(document.createElement("p"), "New text");
		return e.textContent = "Add your message here, then edit it directly on the page.", $(e, {
			margin: "0",
			maxWidth: "680px",
			color: "#51565e",
			fontSize: "16px",
			lineHeight: "1.6"
		}), e;
	}
	if (e === "button") {
		let e = Q(document.createElement("a"), "New button");
		return e.href = "#", e.textContent = "Call to action", $(e, {
			minHeight: "44px",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			padding: "0 20px",
			border: "0",
			borderRadius: "5px",
			color: "#ffffff",
			backgroundColor: "#2678df",
			fontSize: "14px",
			fontWeight: "600",
			textDecoration: "none",
			cursor: "pointer"
		}), e;
	}
	if (e === "image") {
		let e = Q(document.createElement("img"), "New image");
		return e.alt = "Modern collaborative workspace", e.src = "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80", $(e, {
			display: "block",
			width: "100%",
			maxWidth: "720px",
			aspectRatio: "16 / 10",
			objectFit: "cover",
			objectPosition: "center",
			borderRadius: "6px"
		}), e;
	}
	if (e === "divider") {
		let e = Q(document.createElement("hr"), "New divider");
		return $(e, {
			width: "100%",
			margin: "24px 0",
			border: "0",
			borderTop: "1px solid #d9dce0"
		}), e;
	}
	if (e === "spacer") {
		let e = Q(document.createElement("div"), "New spacer");
		return e.setAttribute("aria-hidden", "true"), $(e, {
			width: "100%",
			height: "48px"
		}), e;
	}
	if (e === "list") {
		let e = Q(document.createElement("ul"), "New list");
		for (let t of [
			"First useful point",
			"Second useful point",
			"Third useful point"
		]) {
			let n = document.createElement("li");
			n.textContent = t, e.append(n);
		}
		return $(e, {
			margin: "0",
			paddingLeft: "24px",
			color: "#3f444b",
			fontSize: "16px",
			lineHeight: "1.7"
		}), e;
	}
	if (e === "card") {
		let e = Q(document.createElement("article"), "New card"), t = Q(document.createElement("img"), "Card image");
		t.alt = "Friends enjoying an evening together", t.src = "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80";
		let n = Q(document.createElement("div"), "Card content"), r = Q(document.createElement("h3"), "Card heading");
		r.textContent = "A useful card title";
		let i = Q(document.createElement("p"), "Card text");
		i.textContent = "Add the details people need to understand this item.";
		let a = Q(document.createElement("a"), "Card action");
		return a.href = "#", a.textContent = "Learn more", $(e, {
			width: "100%",
			maxWidth: "360px",
			margin: "32px auto 0",
			overflow: "hidden",
			border: "1px solid #dfe2e6",
			borderRadius: "6px",
			backgroundColor: "#ffffff",
			boxShadow: "0 8px 24px rgb(0 0 0 / 10%)",
			textAlign: "left"
		}), $(t, {
			display: "block",
			width: "100%",
			aspectRatio: "16 / 9",
			objectFit: "cover"
		}), $(n, { padding: "20px" }), $(r, {
			margin: "0",
			color: "#17191d",
			fontSize: "22px",
			lineHeight: "1.25"
		}), $(i, {
			margin: "10px 0 0",
			color: "#555b63",
			fontSize: "15px",
			lineHeight: "1.55"
		}), $(a, {
			marginTop: "16px",
			display: "inline-flex",
			color: "#176bd2",
			fontSize: "14px",
			fontWeight: "600",
			textDecoration: "none"
		}), n.append(r, i, a), e.append(t, n), e;
	}
	if (e === "section") {
		let e = Q(document.createElement("section"), "New section"), t = Q(document.createElement("h2"), "Section heading");
		t.textContent = "New section heading";
		let n = Q(document.createElement("p"), "Section text");
		return n.textContent = "Add the content for this section here.", $(t, {
			margin: "0",
			fontSize: "36px",
			lineHeight: "1.2"
		}), $(n, {
			margin: "16px 0 0",
			maxWidth: "680px",
			color: "#555b63",
			fontSize: "16px",
			lineHeight: "1.6"
		}), $(e, {
			width: "100%",
			padding: "64px 40px",
			backgroundColor: "#ffffff"
		}), e.append(t, n), e;
	}
	let t = e === "columns-2" ? 2 : 3, n = Q(document.createElement("div"), `${t} columns`);
	$(n, {
		display: "grid",
		width: "100%",
		gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
		gap: "24px"
	});
	for (let e = 0; e < t; e += 1) {
		let t = Q(document.createElement("div"), `Column ${e + 1}`), r = Q(document.createElement("p"), `Column ${e + 1} text`);
		r.textContent = `Column ${e + 1} content`, $(t, {
			minHeight: "96px",
			padding: "20px",
			border: "1px solid #dfe2e6",
			borderRadius: "5px"
		}), $(r, {
			margin: "0",
			color: "#51565e",
			fontSize: "15px",
			lineHeight: "1.5"
		}), t.append(r), n.append(t);
	}
	return n;
}
function rr(e, t, n) {
	return e.insertBefore(t, e.children.item(n) ?? null), t;
}
function ir(e, t, n) {
	let r = [...e.children].filter((e) => e instanceof HTMLElement && e !== t), i = Math.max(0, Math.min(n, r.length));
	return e.insertBefore(t, r[i] ?? null), sr(t);
}
function ar(e, t, n) {
	let r = document.createElement("template");
	r.innerHTML = t.trim();
	let i = r.content.firstElementChild;
	return i instanceof HTMLElement ? (rr(e, i, n), i) : null;
}
function or(e) {
	let t = e.cloneNode(!0);
	for (let e of [t, ...t.querySelectorAll("[data-vt-label]")]) {
		let t = e.dataset.vtLabel || e.tagName.toLowerCase();
		e.dataset.vtLabel = cr(`${t} copy`);
	}
	return t;
}
function sr(e) {
	return e.parentElement ? [...e.parentElement.children].indexOf(e) : -1;
}
function Q(e, t) {
	return e.dataset.vtLabel = cr(t), e.dataset.vtGenerated = "true", e;
}
function cr(e) {
	let t = new Set([...document.querySelectorAll("[data-vt-label]")].map((e) => e.dataset.vtLabel));
	if (!t.has(e)) return e;
	let n = 2;
	for (; t.has(`${e} ${n}`);) n += 1;
	return `${e} ${n}`;
}
function $(e, t) {
	for (let [n, r] of Object.entries(t)) e.style.setProperty(lr(n), r);
}
function lr(e) {
	return e.replace(/[A-Z]/g, (e) => `-${e.toLowerCase()}`);
}
//#endregion
//#region src/visual-truth/studio.ts
var ur = "visual-truth:section-library:v1", dr = "visual-truth:named-styles:v1", fr = "visual-truth:repeaters:v1", pr = /* @__PURE__ */ "display.position.inset.width.height.min-width.min-height.max-width.max-height.margin.padding.gap.grid-template-columns.grid-template-rows.grid-column.grid-row.flex.flex-direction.flex-wrap.justify-content.align-items.align-self.order.color.background.background-color.background-image.background-size.background-position.background-repeat.font-family.font-size.font-weight.font-style.line-height.letter-spacing.text-align.text-decoration.border.border-color.border-width.border-style.border-radius.box-shadow.opacity.object-fit.object-position.overflow.aspect-ratio.translate.transform.z-index".split(".");
function mr(e) {
	try {
		let t = JSON.parse(window.localStorage.getItem(e) ?? "[]");
		return Array.isArray(t) ? t : [];
	} catch {
		return [];
	}
}
function hr(e, t) {
	window.localStorage.setItem(e, JSON.stringify(t));
}
var gr = () => mr(ur), _r = (e) => hr(ur, e), vr = () => mr(dr), yr = (e) => hr(dr, e), br = () => mr(fr), xr = (e) => hr(fr, e);
function Sr(e, t) {
	let n = [e, ...e.querySelectorAll("*")], r = [t, ...t.querySelectorAll("*")];
	n.forEach((e, t) => {
		let n = r[t];
		if (!n) return;
		let i = getComputedStyle(e);
		for (let e of pr) {
			let t = i.getPropertyValue(e);
			t && t !== "none" && t !== "normal" && t !== "auto" && n.style.setProperty(e, t);
		}
		n.removeAttribute("contenteditable"), n.classList.remove("vt-editing-text-target"), n.removeAttribute("data-vt-preview-selected");
	});
}
function Cr(e, t = "") {
	let n = e.cloneNode(!0);
	return Sr(e, n), n.dataset.vtLibraryId = crypto.randomUUID(), {
		id: crypto.randomUUID(),
		name: t.trim() || Ct(e),
		html: n.outerHTML,
		createdAt: Date.now()
	};
}
function wr(e, t = "") {
	let n = getComputedStyle(e), r = Object.fromEntries(pr.map((e) => [e, n.getPropertyValue(e).trim()]).filter(([, e]) => e && e !== "none" && e !== "normal" && e !== "auto"));
	return {
		id: crypto.randomUUID(),
		name: t.trim() || `${Ct(e)} style`,
		properties: r,
		createdAt: Date.now()
	};
}
function Tr(e) {
	try {
		let t = JSON.parse(e);
		return t.format === "visual-truth-section" && t.version === 1 && t.section?.html ? t.section : null;
	} catch {
		return null;
	}
}
function Er(e) {
	return JSON.stringify({
		format: "visual-truth-section",
		version: 1,
		section: e
	}, null, 2);
}
function Dr(e, t) {
	return t === e ? ":scope" : (t.dataset.vtBindId || (t.dataset.vtBindId = crypto.randomUUID()), `[data-vt-bind-id="${CSS.escape(t.dataset.vtBindId)}"]`);
}
function Or(e, t) {
	let n = [e, ...e.querySelectorAll("*")], r = /* @__PURE__ */ new Map();
	for (let e of n) if (e.dataset.vtId = crypto.randomUUID(), e.dataset.vtLabel && (e.dataset.vtLabel = `${e.dataset.vtLabel} ${t}`), e.id) {
		let n = `${e.id}--vt-${t.replaceAll(/[^a-z0-9_-]/gi, "-").toLowerCase()}`;
		r.set(e.id, n), e.id = n;
	}
	let i = [
		"aria-labelledby",
		"aria-describedby",
		"aria-controls",
		"aria-owns"
	];
	for (let e of n) {
		let t = e.getAttribute("for");
		t && r.has(t) && e.setAttribute("for", r.get(t));
		let n = e.getAttribute("href");
		n?.startsWith("#") && r.has(n.slice(1)) && e.setAttribute("href", `#${r.get(n.slice(1))}`);
		for (let t of i) {
			let n = e.getAttribute(t);
			n && e.setAttribute(t, n.split(/\s+/).map((e) => r.get(e) ?? e).join(" "));
		}
	}
}
function kr(e) {
	Or(e, `copy-${crypto.randomUUID().slice(0, 8)}`), e.dataset.vtLibraryId = crypto.randomUUID();
}
function Ar(e, t) {
	let n = e.parentElement;
	if (!n) return [];
	n.querySelectorAll(`[data-vt-repeater-instance="${CSS.escape(t.id)}"]`).forEach((e) => e.remove());
	let r = [], i = e;
	return t.data.forEach((a, o) => {
		let s = e.cloneNode(!0);
		s.removeAttribute("data-vt-repeater-template"), s.style.removeProperty("display"), Or(s, `item-${o + 1}-${t.id.slice(0, 6)}`), s.dataset.vtRepeaterInstance = t.id, s.dataset.vtRepeaterIndex = String(o);
		for (let e of t.bindings) {
			let t = e.selector === ":scope" ? s : s.querySelector(e.selector);
			if (!t) continue;
			let n = a[e.field], r = n == null ? "" : String(n);
			e.target === "text" ? t.textContent = r : e.target === "background-image" ? t.style.backgroundImage = r ? `url("${r.replaceAll("\"", "%22")}")` : "none" : r ? t.setAttribute(e.target, r) : t.removeAttribute(e.target);
		}
		n.insertBefore(s, i.nextSibling), i = s, r.push(s);
	}), e.dataset.vtRepeaterTemplate = t.id, e.style.display = "none", r;
}
function jr(e, t) {
	let n = {
		desktop: /* @__PURE__ */ new Set(),
		tablet: /* @__PURE__ */ new Set(),
		phone: /* @__PURE__ */ new Set()
	};
	if (!e) return n;
	let r = H(e);
	for (let e of t) e.kind === "responsive-style" && e.device && e.selector === r && n[e.device].add(e.property);
	return n;
}
function Mr(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) t.set(`${n.device ?? "all"}:${n.selector}:${n.property}`, n);
	return [...t.values()];
}
function Nr(e) {
	let t = Mr(e).map((e) => ({
		selector: e.selector,
		previousSelector: e.previousSelector,
		property: e.property,
		value: e.runtimeValue ?? e.value,
		kind: e.kind,
		parentSelector: e.parentSelector,
		index: e.index,
		html: e.html,
		device: e.device
	}));
	return `// Generated by Visual Truth. Review in source control before publishing.
const media = { desktop: '(min-width: 1101px)', tablet: '(min-width: 681px) and (max-width: 1100px)', phone: '(max-width: 680px)' } as const
type Patch = { selector: string; previousSelector?: string; property: string; value: string; kind: string; parentSelector?: string; index?: number; html?: string; device?: keyof typeof media }
export const visualTruthPatches = ${JSON.stringify(t, null, 2)} as const satisfies readonly Patch[]\n\nfunction target(selector: string, previousSelector?: string) { return document.querySelector<HTMLElement>(selector) ?? (previousSelector ? document.querySelector<HTMLElement>(previousSelector) : null) }\nfunction applyPatch(patch: Patch) {\n  if (patch.device && !window.matchMedia(media[patch.device]).matches) return\n  const element = target(patch.selector, patch.previousSelector)\n  if (patch.kind === 'style' || patch.kind === 'responsive-style') { if (element?.style.getPropertyValue(patch.property) !== patch.value) element?.style.setProperty(patch.property, patch.value); return }\n  if (patch.kind === 'text') { if (element && element.innerText !== patch.value) element.innerText = patch.value; return }\n  if (patch.kind === 'attribute') { const name = patch.property.slice('attribute:'.length); if (patch.value && element?.getAttribute(name) !== patch.value) element?.setAttribute(name, patch.value); else if (!patch.value && element?.hasAttribute(name)) element.removeAttribute(name); return }\n  const parent = patch.parentSelector ? document.querySelector<HTMLElement>(patch.parentSelector) : null\n  if (patch.kind === 'remove') { element?.remove(); return }\n  if (patch.kind === 'insert' && parent && !element && patch.html) { const box = document.createElement('template'); box.innerHTML = patch.html.trim(); const node = box.content.firstElementChild; if (node) parent.insertBefore(node, parent.children.item(patch.index ?? parent.children.length)); return }\n  if (patch.kind === 'reorder' && parent && element) parent.insertBefore(element, parent.children.item(patch.index ?? 0))\n}\nexport function installVisualTruthPatches() {\n  let queued = false\n  const apply = () => { queued = false; (visualTruthPatches as readonly Patch[]).forEach(applyPatch) }\n  const schedule = () => { if (!queued) { queued = true; window.requestAnimationFrame(apply) } }\n  schedule(); window.addEventListener('resize', schedule)\n  const observer = new MutationObserver(schedule); observer.observe(document.documentElement, { childList: true, subtree: true })\n  return () => { observer.disconnect(); window.removeEventListener('resize', schedule) }\n}\n`;
}
//#endregion
//#region src/visual-truth/assets/visual-truth-icon.svg
var Pr = "data:image/svg+xml,%3c?xml%20version='1.0'%20encoding='UTF-8'?%3e%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20512%20512'%20role='img'%20aria-labelledby='title%20desc'%3e%3ctitle%20id='title'%3eVisual%20Truth%20icon%3c/title%3e%3cdesc%20id='desc'%3eA%20blue%20selection%20frame%20with%20four%20corner%20handles%20and%20a%20centered%20black%20plus.%3c/desc%3e%3cg%20id='selection-frame'%20fill='%232477E8'%3e%3crect%20id='top-guide'%20x='100'%20y='56'%20width='312'%20height='20'/%3e%3crect%20id='right-guide'%20x='436'%20y='100'%20width='20'%20height='312'/%3e%3crect%20id='bottom-guide'%20x='100'%20y='436'%20width='312'%20height='20'/%3e%3crect%20id='left-guide'%20x='56'%20y='100'%20width='20'%20height='312'/%3e%3crect%20id='top-left-handle'%20x='36'%20y='36'%20width='64'%20height='64'/%3e%3crect%20id='top-right-handle'%20x='412'%20y='36'%20width='64'%20height='64'/%3e%3crect%20id='bottom-left-handle'%20x='36'%20y='412'%20width='64'%20height='64'/%3e%3crect%20id='bottom-right-handle'%20x='412'%20y='412'%20width='64'%20height='64'/%3e%3c/g%3e%3cg%20id='center-plus'%20fill='%23111722'%3e%3crect%20x='185'%20y='246'%20width='142'%20height='20'/%3e%3crect%20x='246'%20y='185'%20width='20'%20height='142'/%3e%3c/g%3e%3c/svg%3e", Fr = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NjAgMjIwIiByb2xlPSJpbWciIGFyaWEtbGFiZWxsZWRieT0idGl0bGUgZGVzYyI+CiAgPHRpdGxlIGlkPSJ0aXRsZSI+VmlzdWFsIFRydXRoPC90aXRsZT4KICA8ZGVzYyBpZD0iZGVzYyI+QSBibHVlIHNlbGVjdGlvbi1mcmFtZSBzeW1ib2wgd2l0aCBhIGNlbnRlcmVkIHdoaXRlIHBsdXMgYmVzaWRlIHRoZSBzdGFja2VkIHdvcmRzIFZpc3VhbCBUcnV0aC48L2Rlc2M+CiAgPGcgaWQ9InNlbGVjdGlvbi1tYXJrIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxNiAxNikgc2NhbGUoLjM2NzE4NzUpIj4KICAgIDxnIGlkPSJzZWxlY3Rpb24tZnJhbWUiIGZpbGw9IiM0QjkzRjQiPgogICAgICA8cmVjdCB4PSIxMDAiIHk9IjU2IiB3aWR0aD0iMzEyIiBoZWlnaHQ9IjIwIi8+CiAgICAgIDxyZWN0IHg9IjQzNiIgeT0iMTAwIiB3aWR0aD0iMjAiIGhlaWdodD0iMzEyIi8+CiAgICAgIDxyZWN0IHg9IjEwMCIgeT0iNDM2IiB3aWR0aD0iMzEyIiBoZWlnaHQ9IjIwIi8+CiAgICAgIDxyZWN0IHg9IjU2IiB5PSIxMDAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIzMTIiLz4KICAgICAgPHJlY3QgeD0iMzYiIHk9IjM2IiB3aWR0aD0iNjQiIGhlaWdodD0iNjQiLz4KICAgICAgPHJlY3QgeD0iNDEyIiB5PSIzNiIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ii8+CiAgICAgIDxyZWN0IHg9IjM2IiB5PSI0MTIiIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIvPgogICAgICA8cmVjdCB4PSI0MTIiIHk9IjQxMiIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ii8+CiAgICA8L2c+CiAgICA8ZyBpZD0iY2VudGVyLXBsdXMiIGZpbGw9IiNGRkZGRkYiPgogICAgICA8cmVjdCB4PSIxODUiIHk9IjI0NiIgd2lkdGg9IjE0MiIgaGVpZ2h0PSIyMCIvPgogICAgICA8cmVjdCB4PSIyNDYiIHk9IjE4NSIgd2lkdGg9IjIwIiBoZWlnaHQ9IjE0MiIvPgogICAgPC9nPgogIDwvZz4KICA8ZyBpZD0id29yZG1hcmsiIGZpbGw9IiNGRkZGRkYiIGZvbnQtZmFtaWx5PSJIZWx2ZXRpY2EgTmV1ZSwgSGVsdmV0aWNhLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI3NiIgZm9udC13ZWlnaHQ9IjgwMCI+CiAgICA8dGV4dCB4PSIyMjgiIHk9IjEwMSI+VklTVUFMPC90ZXh0PgogICAgPHRleHQgeD0iMjI4IiB5PSIxODEiPlRSVVRIPC90ZXh0PgogIDwvZz4KPC9zdmc+Cg==", Ir = [
	["Inter", "Inter, sans-serif"],
	["Arial", "Arial, sans-serif"],
	["DM Sans", "\"DM Sans\", sans-serif"],
	["Georgia", "Georgia, serif"],
	["Manrope", "Manrope, sans-serif"]
];
function Lr(e) {
	if (/^#[\da-f]{6}$/i.test(e)) return e;
	let t = e.match(/[\d.]+/g)?.slice(0, 3).map(Number);
	return t?.length === 3 ? `#${t.map((e) => Math.max(0, Math.min(255, Math.round(e))).toString(16).padStart(2, "0")).join("")}` : "#111111";
}
function Rr({ selected: e, metrics: t, dragBehavior: n, onDragBehavior: o, onStyle: s, onAttribute: c, onEditText: l, editScope: u, onEditScope: p, onSmartAction: m }) {
	let ee = r(null), [h, te] = i(!1);
	if (!e || !t) return /* @__PURE__ */ V("aside", {
		className: "vt-easy-inspector vt-easy-empty",
		children: [
			/* @__PURE__ */ B("span", {
				className: "vt-easy-empty-icon",
				children: "↖"
			}),
			/* @__PURE__ */ B("strong", { children: "Select an element" }),
			/* @__PURE__ */ B("p", { children: "Click anything on the canvas to edit its most useful settings." })
		]
	});
	let g = Nt(e), _ = e.matches("img"), v = !g && !_, y = Math.round(t.fontSize), b = (e) => {
		if (!e) return;
		let t = new FileReader();
		t.onload = () => typeof t.result == "string" && c("src", t.result, `Replace image with "${e.name}"`), t.readAsDataURL(e);
	};
	return /* @__PURE__ */ V("aside", {
		className: "vt-easy-inspector",
		"aria-label": "Contextual inspector",
		children: [
			/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B("span", { children: g ? /* @__PURE__ */ B(ht, { size: 17 }) : _ ? /* @__PURE__ */ B(Fe, { size: 17 }) : "▦" }), /* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: g ? "Text" : _ ? "Image" : wt(e) }), /* @__PURE__ */ B("small", { children: wt(e) })] })] }),
			/* @__PURE__ */ V("section", {
				className: "vt-easy-scope",
				children: [/* @__PURE__ */ B("label", { children: "Apply to" }), /* @__PURE__ */ B("div", {
					className: "vt-easy-segment vt-easy-label-segment",
					children: [
						"all",
						"desktop",
						"tablet",
						"phone"
					].map((e) => /* @__PURE__ */ B("button", {
						className: u === e ? "active" : "",
						onClick: () => p(e),
						children: e === "all" ? "All" : e === "tablet" ? "iPad" : e[0].toUpperCase() + e.slice(1)
					}, e))
				})]
			}),
			g ? /* @__PURE__ */ V(z, { children: [
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Content" }), /* @__PURE__ */ B("button", {
					className: "vt-easy-content",
					onClick: l,
					children: e.innerText || "Edit text on canvas"
				})] }),
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Font" }), /* @__PURE__ */ B("select", {
					value: Ir.find(([, e]) => t.fontFamily.includes(e.split(",")[0].replaceAll("\"", "")))?.[1] ?? t.fontFamily,
					onChange: (e) => s("font-family", e.target.value),
					children: Ir.map(([e, t]) => /* @__PURE__ */ B("option", {
						value: t,
						children: e
					}, t))
				})] }),
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Size" }), /* @__PURE__ */ V("div", {
					className: "vt-easy-stepper",
					children: [
						/* @__PURE__ */ V("button", {
							"aria-label": "Decrease font size",
							onClick: () => s("font-size", `${Math.max(8, y - 1)}px`),
							children: [/* @__PURE__ */ B(M, { size: 15 }), /* @__PURE__ */ B("span", { children: "A" })]
						}),
						/* @__PURE__ */ B("input", {
							"aria-label": "Font size",
							inputMode: "numeric",
							value: y,
							onChange: (e) => {
								let t = Number(e.target.value);
								Number.isFinite(t) && s("font-size", `${Math.max(8, Math.min(240, t))}px`);
							}
						}),
						/* @__PURE__ */ V("button", {
							"aria-label": "Increase font size",
							onClick: () => s("font-size", `${Math.min(240, y + 1)}px`),
							children: [/* @__PURE__ */ B("span", { children: "A" }), /* @__PURE__ */ B(Ze, { size: 15 })]
						})
					]
				})] }),
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Alignment" }), /* @__PURE__ */ V("div", {
					className: "vt-easy-segment",
					role: "group",
					"aria-label": "Text alignment",
					children: [
						/* @__PURE__ */ B("button", {
							"aria-label": "Align text left",
							"aria-pressed": t.textAlign === "left",
							className: t.textAlign === "left" ? "active" : "",
							onClick: () => s("text-align", "left"),
							children: /* @__PURE__ */ B(d, { size: 16 })
						}),
						/* @__PURE__ */ B("button", {
							"aria-label": "Align text center",
							"aria-pressed": t.textAlign === "center",
							className: t.textAlign === "center" ? "active" : "",
							onClick: () => s("text-align", "center"),
							children: /* @__PURE__ */ B(a, { size: 16 })
						}),
						/* @__PURE__ */ B("button", {
							"aria-label": "Align text right",
							"aria-pressed": t.textAlign === "right",
							className: t.textAlign === "right" ? "active" : "",
							onClick: () => s("text-align", "right"),
							children: /* @__PURE__ */ B(f, { size: 16 })
						})
					]
				})] }),
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Color" }), /* @__PURE__ */ V("div", {
					className: "vt-easy-color",
					children: [/* @__PURE__ */ B("input", {
						type: "color",
						"aria-label": "Text color",
						value: Lr(t.color),
						onChange: (e) => s("color", e.target.value)
					}), /* @__PURE__ */ B("code", { children: Lr(t.color) })]
				})] }),
				/* @__PURE__ */ B(zr, {
					label: "Text box width",
					value: t.width,
					min: 80,
					max: 1200,
					unit: "px",
					onChange: (e) => s("width", `${e}px`),
					onReset: () => s("width", "auto")
				}),
				/* @__PURE__ */ V("section", { children: [
					/* @__PURE__ */ B("label", { children: "When dragging handles" }),
					/* @__PURE__ */ V("div", {
						className: "vt-drag-behavior",
						role: "group",
						"aria-label": "Text box drag behavior",
						children: [/* @__PURE__ */ B("button", {
							className: n === "scale" ? "active" : "",
							"aria-pressed": n === "scale",
							onClick: () => o("scale"),
							children: "Text + box"
						}), /* @__PURE__ */ B("button", {
							className: n === "reflow" ? "active" : "",
							"aria-pressed": n === "reflow",
							onClick: () => o("reflow"),
							children: "Box only"
						})]
					}),
					/* @__PURE__ */ B("small", {
						className: "vt-easy-help",
						children: n === "scale" ? "Drag any resize handle to grow or shrink the box and font together while keeping the text inside." : "Drag the handles to resize only the box. The font size stays unchanged while the text reflows."
					})
				] })
			] }) : null,
			_ ? /* @__PURE__ */ V(z, { children: [
				/* @__PURE__ */ V("section", { children: [
					/* @__PURE__ */ B("label", { children: "Image" }),
					/* @__PURE__ */ B("input", {
						ref: ee,
						hidden: !0,
						type: "file",
						accept: "image/*",
						onChange: (e) => {
							b(e.target.files?.[0]), e.currentTarget.value = "";
						}
					}),
					/* @__PURE__ */ V("button", {
						className: "vt-easy-primary-row",
						onClick: () => ee.current?.click(),
						children: [/* @__PURE__ */ B(Fe, { size: 15 }), "Replace image"]
					})
				] }),
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Crop & fit" }), /* @__PURE__ */ V("div", {
					className: "vt-easy-segment vt-easy-label-segment",
					children: [/* @__PURE__ */ V("button", {
						className: t.objectFit === "cover" ? "active" : "",
						onClick: () => s("object-fit", "cover"),
						children: [/* @__PURE__ */ B(ve, { size: 14 }), "Fill"]
					}), /* @__PURE__ */ B("button", {
						className: t.objectFit === "contain" ? "active" : "",
						onClick: () => s("object-fit", "contain"),
						children: "Fit"
					})]
				})] }),
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Focus" }), /* @__PURE__ */ B("div", {
					className: "vt-focal-grid",
					children: [
						"0% 0%",
						"50% 0%",
						"100% 0%",
						"0% 50%",
						"50% 50%",
						"100% 50%",
						"0% 100%",
						"50% 100%",
						"100% 100%"
					].map((e) => /* @__PURE__ */ B("button", {
						className: t.objectPosition === e ? "active" : "",
						"aria-label": `Set image focus ${e}`,
						onClick: () => s("object-position", e)
					}, e))
				})] })
			] }) : null,
			v ? /* @__PURE__ */ V(z, { children: [
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Layout" }), /* @__PURE__ */ V("div", {
					className: "vt-easy-segment vt-easy-label-segment",
					children: [
						/* @__PURE__ */ B("button", {
							className: t.display === "block" ? "active" : "",
							onClick: () => s("display", "block"),
							children: "Stack"
						}),
						/* @__PURE__ */ B("button", {
							className: t.display.includes("flex") ? "active" : "",
							onClick: () => s("display", "flex"),
							children: "Row"
						}),
						/* @__PURE__ */ B("button", {
							className: t.display === "grid" ? "active" : "",
							onClick: () => s("display", "grid"),
							children: "Grid"
						})
					]
				})] }),
				/* @__PURE__ */ B(zr, {
					label: "Gap",
					value: t.gap,
					min: 0,
					max: 96,
					unit: "px",
					onChange: (e) => s("gap", `${e}px`),
					onReset: () => s("gap", "0px")
				}),
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Background" }), /* @__PURE__ */ V("div", {
					className: "vt-easy-color",
					children: [/* @__PURE__ */ B("input", {
						type: "color",
						"aria-label": "Background color",
						value: Lr(t.backgroundColor),
						onChange: (e) => s("background-color", e.target.value)
					}), /* @__PURE__ */ B("code", { children: Lr(t.backgroundColor) })]
				})] }),
				/* @__PURE__ */ B(zr, {
					label: "Corner radius",
					value: t.borderRadius,
					min: 0,
					max: 80,
					unit: "px",
					onChange: (e) => s("border-radius", `${e}px`),
					onReset: () => s("border-radius", "0px")
				}),
				/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("label", { children: "Padding" }), /* @__PURE__ */ B("div", {
					className: "vt-easy-padding-grid",
					children: [
						[
							"Top",
							t.paddingTop,
							"padding-top"
						],
						[
							"Right",
							t.paddingRight,
							"padding-right"
						],
						[
							"Bottom",
							t.paddingBottom,
							"padding-bottom"
						],
						[
							"Left",
							t.paddingLeft,
							"padding-left"
						]
					].map(([e, t, n]) => /* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B("span", { children: e }), /* @__PURE__ */ B("input", {
						type: "number",
						min: "0",
						value: Math.round(t),
						onChange: (e) => s(n, `${Math.max(0, Number(e.target.value))}px`)
					})] }, n))
				})] })
			] }) : null,
			/* @__PURE__ */ V("section", {
				className: "vt-smart-actions",
				children: [/* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B(lt, { size: 13 }), "Smart actions"] }), /* @__PURE__ */ B("div", { children: [
					["match-spacing", "Match sibling spacing"],
					["distribute", "Distribute evenly"],
					["responsive", "Make responsive"],
					["typography", "Use project typography"],
					["contrast", "Fix contrast"]
				].map(([e, t]) => /* @__PURE__ */ B("button", {
					onClick: () => m(e),
					children: t
				}, e)) })]
			}),
			/* @__PURE__ */ V("button", {
				className: "vt-easy-advanced",
				onClick: () => te((e) => !e),
				children: [h ? "Hide" : "Show", " advanced properties"]
			}),
			h ? /* @__PURE__ */ V("div", {
				className: "vt-easy-advanced-fields",
				children: [
					/* @__PURE__ */ V("label", { children: ["Width", /* @__PURE__ */ B("input", {
						value: `${Math.round(t.width)}px`,
						onChange: (e) => s("width", e.target.value)
					})] }),
					/* @__PURE__ */ V("label", { children: ["Height", /* @__PURE__ */ B("input", {
						value: `${Math.round(t.height)}px`,
						onChange: (e) => s("height", e.target.value)
					})] }),
					/* @__PURE__ */ B(zr, {
						label: "Opacity",
						value: t.opacity * 100,
						min: 0,
						max: 100,
						unit: "%",
						onChange: (e) => s("opacity", String(e / 100)),
						onReset: () => s("opacity", "1")
					})
				]
			}) : null
		]
	});
}
function zr({ label: e, value: t, min: n, max: r, unit: i, onChange: a, onReset: o }) {
	let s = Math.round(t);
	return /* @__PURE__ */ V("section", {
		className: "vt-numeric-slider",
		children: [/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("label", { children: e }), /* @__PURE__ */ B("button", {
			"aria-label": `Reset ${e.toLowerCase()}`,
			title: `Reset ${e.toLowerCase()}`,
			onClick: o,
			children: /* @__PURE__ */ B(et, { size: 12 })
		})] }), /* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("input", {
			type: "range",
			min: n,
			max: r,
			value: Math.min(r, Math.max(n, s)),
			onChange: (e) => a(Number(e.target.value))
		}), /* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B("input", {
			type: "number",
			min: n,
			max: r,
			value: s,
			onChange: (e) => a(Math.max(n, Math.min(r, Number(e.target.value))))
		}), /* @__PURE__ */ B("span", { children: i })] })] })]
	});
}
//#endregion
//#region src/visual-truth/ChangeReview.tsx
var Br = {
	width: "width",
	height: "height",
	"font-size": "font size",
	"background-color": "background",
	color: "text color",
	translate: "position",
	"object-fit": "image fit",
	"object-position": "image focus",
	"border-radius": "corner radius",
	gap: "gap"
}, Vr = (e) => e.replace(/rgba?\(([^)]+)\)/, "$1").replace(/\s+/g, " ").trim(), Hr = (e) => {
	if (e.kind === "text") return `Text changed from “${Vr(e.previousValue).slice(0, 34)}” to “${Vr(e.value).slice(0, 34)}”`;
	if (e.kind === "insert") return `${e.label} added`;
	if (e.kind === "remove") return `${e.label} removed`;
	if (e.kind === "reorder") return `${e.label} moved in its section`;
	let t = Br[e.property] ?? e.property.replaceAll("-", " "), n = e.device ? ` on ${e.device === "tablet" ? "iPad" : e.device}` : "";
	return `${t[0].toUpperCase()}${t.slice(1)} changed from ${Vr(e.previousValue)} to ${Vr(e.value)}${n}`;
};
function Ur({ changes: e, selectedIds: t, sessions: r, comparing: a, onToggle: o, onToggleSession: s, onCreateSession: c, onCompare: l, onRevert: u, onSaveVersion: d, onApply: f, applying: p, applyMessage: m }) {
	let [ee, h] = i(!1), [te, g] = i(""), _ = n(() => Object.entries(e.reduce((e, t) => ((e[t.label] ??= []).push(t), e), {})), [e]);
	return /* @__PURE__ */ V("aside", {
		className: "vt-review-panel",
		"aria-label": "Review changes",
		children: [
			/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: "Review changes" }), /* @__PURE__ */ V("span", { children: [e.length, " changes"] })] }), /* @__PURE__ */ B("p", { children: "Choose exactly what becomes durable source." })] }),
			e.length ? /* @__PURE__ */ V("div", {
				className: "vt-change-session-tools",
				children: [
					/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("input", {
						value: te,
						onChange: (e) => g(e.target.value),
						placeholder: "Name this session"
					}), /* @__PURE__ */ V("button", {
						disabled: !te.trim(),
						onClick: () => {
							c(te.trim()), g("");
						},
						children: [/* @__PURE__ */ B(Oe, { size: 13 }), "Group"]
					})] }),
					/* @__PURE__ */ V("button", {
						className: a ? "active" : "",
						onPointerDown: () => l(!0),
						onPointerUp: () => l(!1),
						onPointerLeave: () => a && l(!1),
						children: [B(a ? Te : E, { size: 13 }), "Hold to compare original"]
					}),
					r.map((e) => /* @__PURE__ */ V("button", {
						className: e.enabled ? "enabled" : "",
						onClick: () => s(e),
						children: [
							/* @__PURE__ */ B("span", { children: e.name }),
							/* @__PURE__ */ B("small", { children: e.changeIds.length }),
							e.enabled ? /* @__PURE__ */ B(E, { size: 12 }) : /* @__PURE__ */ B(Te, { size: 12 })
						]
					}, e.id))
				]
			}) : null,
			/* @__PURE__ */ V("div", {
				className: "vt-review-list",
				children: [_.map(([e, n]) => /* @__PURE__ */ V("section", { children: [/* @__PURE__ */ V("div", {
					className: "vt-review-group-title",
					children: [/* @__PURE__ */ B("strong", { children: e }), /* @__PURE__ */ V("button", {
						onClick: () => n.slice().reverse().forEach(u),
						children: [/* @__PURE__ */ B(et, { size: 13 }), "Revert"]
					})]
				}), n.map((e) => /* @__PURE__ */ V("div", {
					className: "vt-review-change",
					children: [/* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B("input", {
						type: "checkbox",
						checked: t.has(e.id),
						onChange: () => o(e.id)
					}), /* @__PURE__ */ B("span", { children: Hr(e) })] }), e.kind === "style" || e.kind === "responsive-style" ? /* @__PURE__ */ V("div", {
						className: "vt-review-visual",
						children: [
							/* @__PURE__ */ V("figure", { children: [/* @__PURE__ */ B("i", {
								style: Wr(e.property, e.previousRuntimeValue ?? e.previousValue),
								children: Gr(e)
							}), /* @__PURE__ */ B("figcaption", { children: "Before" })] }),
							/* @__PURE__ */ B("span", { children: "→" }),
							/* @__PURE__ */ V("figure", { children: [/* @__PURE__ */ B("i", {
								style: Wr(e.property, e.runtimeValue ?? e.value),
								children: Gr(e)
							}), /* @__PURE__ */ B("figcaption", { children: "After" })] })
						]
					}) : null]
				}, e.id))] }, e)), e.length ? null : /* @__PURE__ */ V("div", {
					className: "vt-review-empty",
					children: [
						/* @__PURE__ */ B(ie, { size: 24 }),
						/* @__PURE__ */ B("strong", { children: "No changes to review" }),
						/* @__PURE__ */ B("p", { children: "Edit the page and your readable change list will appear here." })
					]
				})]
			}),
			e.length ? /* @__PURE__ */ V("section", {
				className: "vt-code-summary",
				children: [
					/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B(w, { size: 15 }), /* @__PURE__ */ B("strong", { children: "Make It Code" })] }),
					/* @__PURE__ */ V("p", { children: [
						"Update ",
						new Set(e.filter((e) => t.has(e.id)).map((e) => e.selector)).size,
						" elements with ",
						t.size,
						" selected changes."
					] }),
					/* @__PURE__ */ V("button", {
						onClick: () => h((e) => !e),
						children: ["View source summary ", /* @__PURE__ */ B(oe, { size: 14 })]
					}),
					ee ? /* @__PURE__ */ B("pre", { children: e.filter((e) => t.has(e.id)).map(Hr).join("\n") }) : null
				]
			}) : null,
			/* @__PURE__ */ V("footer", { children: [
				/* @__PURE__ */ B("button", {
					onClick: d,
					children: "Save version"
				}),
				/* @__PURE__ */ B("button", {
					className: "primary",
					disabled: !t.size || p,
					onClick: f,
					children: p ? "Applying…" : "Apply selected changes"
				}),
				/* @__PURE__ */ V("small", { children: [/* @__PURE__ */ B(ot, { size: 13 }), "Nothing is published. Changes stay local."] }),
				m ? /* @__PURE__ */ B("p", {
					role: "status",
					children: m
				}) : null
			] })
		]
	});
}
function Wr(e, t) {
	let n = [
		"color",
		"background-color",
		"font-size",
		"font-weight",
		"border-radius",
		"opacity",
		"text-align",
		"letter-spacing",
		"line-height"
	].includes(e) ? e : "";
	return n ? { [n]: t } : {};
}
function Gr(e) {
	return e.property === "background-color" || e.property === "border-radius" || e.property === "opacity" ? "Button" : "Aa";
}
//#endregion
//#region src/visual-truth/CommandPalette.tsx
function Kr({ open: e, commands: t, onClose: r }) {
	let [a, o] = i(""), s = n(() => t.filter((e) => e.label.toLowerCase().includes(a.toLowerCase())), [t, a]);
	return e ? /* @__PURE__ */ B("div", {
		className: "vt-command-backdrop",
		role: "presentation",
		onMouseDown: r,
		children: /* @__PURE__ */ V("div", {
			className: "vt-command",
			role: "dialog",
			"aria-modal": "true",
			"aria-label": "Visual Truth commands",
			onMouseDown: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ V("label", { children: [/* @__PURE__ */ B(rt, { size: 17 }), /* @__PURE__ */ B("input", {
				autoFocus: !0,
				placeholder: "Search commands…",
				value: a,
				onChange: (e) => o(e.target.value),
				onKeyDown: (e) => {
					e.key === "Escape" && r(), e.key === "Enter" && s[0] && (s[0].run(), r());
				}
			})] }), /* @__PURE__ */ B("div", { children: s.map((e) => /* @__PURE__ */ V("button", {
				onClick: () => {
					e.run(), r();
				},
				children: [/* @__PURE__ */ B("span", { children: e.label }), e.hint ? /* @__PURE__ */ B("kbd", { children: e.hint }) : null]
			}, e.id)) })]
		})
	}) : null;
}
//#endregion
//#region src/visual-truth/ProductAssist.tsx
var qr = (e, t) => {
	let n = (e) => (e.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [
		0,
		0,
		0
	]).map((e) => {
		let t = e / 255;
		return t <= .03928 ? t / 12.92 : ((t + .055) / 1.055) ** 2.4;
	}), r = (e) => {
		let [t, r, i] = n(e);
		return .2126 * t + .7152 * r + .0722 * i;
	}, [i, a] = [r(e), r(t)].sort((e, t) => t - e);
	return (i + .05) / (a + .05);
};
function Jr({ selected: e, onStyle: t, onClose: r }) {
	let [a, o] = i("theme"), s = n(() => {
		let e = [...document.querySelectorAll("body *:not([data-visual-truth-ui] *)")].slice(0, 300), t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map();
		e.forEach((e) => {
			let i = getComputedStyle(e);
			[i.color, i.backgroundColor].forEach((e) => t.set(e, (t.get(e) ?? 0) + 1)), n.set(i.fontFamily, (n.get(i.fontFamily) ?? 0) + 1), r.set(i.borderRadius, (r.get(i.borderRadius) ?? 0) + 1);
		});
		let i = (e, t) => [...e].filter(([e]) => e && e !== "rgba(0, 0, 0, 0)" && e !== "0px").sort((e, t) => t[1] - e[1]).slice(0, t).map(([e]) => e);
		return {
			colors: i(t, 8),
			fonts: i(n, 4),
			radii: i(r, 5)
		};
	}, []), c = n(() => {
		let e = [...document.querySelectorAll("img:not([data-visual-truth-ui] img)")], t = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")], n = t.some((e, n) => n > 0 && Number(e.tagName[1]) - Number(t[n - 1].tagName[1]) > 1), r = [...document.querySelectorAll("a,button,input,select")].filter((e) => !e.closest("[data-visual-truth-ui]") && (e.getBoundingClientRect().width < 44 || e.getBoundingClientRect().height < 44)), i = [...document.querySelectorAll("a")].filter((e) => !e.closest("[data-visual-truth-ui]") && !(e.textContent?.trim() || e.getAttribute("aria-label") || e.querySelector("img[alt]"))), a = [...document.querySelectorAll("p,h1,h2,h3,h4,h5,h6,a,button")].filter((e) => !e.closest("[data-visual-truth-ui]")).slice(0, 100).filter((e) => {
			let t = getComputedStyle(e);
			return qr(t.color, t.backgroundColor === "rgba(0, 0, 0, 0)" ? getComputedStyle(e.parentElement ?? document.body).backgroundColor : t.backgroundColor) < 4.5;
		});
		return [
			{
				label: "Image descriptions",
				detail: e.every((e) => e.alt.trim()) ? "Every image has alt text." : `${e.filter((e) => !e.alt.trim()).length} images need alt text.`,
				pass: e.every((e) => e.alt.trim())
			},
			{
				label: "Heading order",
				detail: n ? "A heading level is skipped." : "Heading levels follow a clear order.",
				pass: !n
			},
			{
				label: "Text contrast",
				detail: a.length ? `${a.length} text elements may need stronger contrast.` : "Text contrast checks passed.",
				pass: !a.length
			},
			{
				label: "Tap target size",
				detail: r.length ? `${r.length} controls are smaller than 44 × 44.` : "Controls meet the recommended touch size.",
				pass: !r.length
			},
			{
				label: "Link labels",
				detail: i.length ? `${i.length} links need a readable label.` : "Links have readable labels.",
				pass: !i.length
			},
			{
				label: "Keyboard focus",
				detail: "Interactive controls retain visible browser focus behavior.",
				pass: !0
			}
		];
	}, []);
	return /* @__PURE__ */ V("aside", {
		className: "vt-assist-panel",
		children: [
			/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B(Yr, {}), /* @__PURE__ */ B("strong", { children: "Site quality" })] }), /* @__PURE__ */ B("button", {
				onClick: r,
				"aria-label": "Close site quality",
				children: /* @__PURE__ */ B(bt, { size: 15 })
			})] }),
			/* @__PURE__ */ V("div", {
				className: "vt-assist-tabs",
				children: [/* @__PURE__ */ V("button", {
					className: a === "theme" ? "active" : "",
					onClick: () => o("theme"),
					children: [/* @__PURE__ */ B(Xe, { size: 14 }), "Theme"]
				}), /* @__PURE__ */ V("button", {
					className: a === "accessibility" ? "active" : "",
					onClick: () => o("accessibility"),
					children: [/* @__PURE__ */ B(ot, { size: 14 }), "Accessibility"]
				})]
			}),
			a === "theme" ? /* @__PURE__ */ V("div", {
				className: "vt-theme-panel",
				children: [
					/* @__PURE__ */ B("p", { children: "Reuse your project’s real design tokens to keep edits consistent." }),
					/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("strong", { children: "Project colors" }), /* @__PURE__ */ B("div", {
						className: "vt-theme-colors",
						children: s.colors.map((n) => /* @__PURE__ */ B("button", {
							style: { background: n },
							title: `Apply ${n}`,
							disabled: !e,
							onClick: () => t("color", n)
						}, n))
					})] }),
					/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("strong", { children: "Typography" }), s.fonts.map((n) => /* @__PURE__ */ B("button", {
						disabled: !e,
						onClick: () => t("font-family", n),
						children: n.split(",")[0].replaceAll("\"", "")
					}, n))] }),
					/* @__PURE__ */ V("section", { children: [/* @__PURE__ */ B("strong", { children: "Corner radii" }), /* @__PURE__ */ B("div", {
						className: "vt-theme-radii",
						children: s.radii.map((n) => /* @__PURE__ */ V("button", {
							disabled: !e,
							onClick: () => t("border-radius", n),
							children: [/* @__PURE__ */ B("i", { style: { borderRadius: n } }), n]
						}, n))
					})] }),
					/* @__PURE__ */ B("small", { children: "One-off values are flagged when they do not match a frequently used project token." })
				]
			}) : /* @__PURE__ */ V("div", {
				className: "vt-a11y-panel",
				children: [/* @__PURE__ */ B("p", { children: "Live checks update against the page currently on the canvas." }), c.map((e) => /* @__PURE__ */ V("div", {
					className: e.pass ? "pass" : "warn",
					children: [e.pass ? /* @__PURE__ */ B(ae, { size: 16 }) : /* @__PURE__ */ B(le, { size: 16 }), /* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: e.label }), /* @__PURE__ */ B("small", { children: e.detail })] })]
				}, e.label))]
			})
		]
	});
}
function Yr() {
	return /* @__PURE__ */ B("span", {
		className: "vt-assist-spark",
		children: "✦"
	});
}
//#endregion
//#region src/visual-truth/EasyLayersPanel.tsx
var Xr = "main, header, footer, nav, section, article, aside", Zr = "[data-vt-label], h1, h2, h3, h4, h5, h6, p, a, button, img, figure, ul, ol, li, form, input, textarea, select, [role=\"button\"]";
function Qr({ selected: e, revision: t, onSelect: n, onIsolate: r }) {
	let [a, o] = i(""), s = e?.closest("section, article, header, footer, nav, main") ?? document.querySelector("main"), c = (() => {
		if (!s) return [];
		let e = s.matches(Xr) ? [
			s,
			s.previousElementSibling,
			s.nextElementSibling
		].filter((e) => e instanceof HTMLElement && e.matches(Xr)) : [s], t = /* @__PURE__ */ new Set();
		e.forEach((e) => {
			t.add(e), e.querySelectorAll(Zr).forEach((e) => t.add(e));
		});
		let n = a.trim().toLowerCase();
		return [...t].filter((e) => !n || wt(e).toLowerCase().includes(n)).slice(0, 80);
	})();
	return /* @__PURE__ */ V("aside", {
		className: "vt-layers vt-easy-layers",
		"data-visual-truth-ui": !0,
		children: [
			/* @__PURE__ */ V("header", { children: [
				/* @__PURE__ */ B(Le, { size: 16 }),
				/* @__PURE__ */ B("strong", { children: "Layers" }),
				/* @__PURE__ */ B("span", { children: "Focused" })
			] }),
			/* @__PURE__ */ V("label", {
				className: "vt-layer-search",
				children: [/* @__PURE__ */ B(rt, { size: 13 }), /* @__PURE__ */ B("input", {
					value: a,
					onChange: (e) => o(e.target.value),
					placeholder: "Search this section"
				})]
			}),
			s ? /* @__PURE__ */ V("button", {
				className: "vt-easy-focus-card",
				onDoubleClick: () => r(s),
				onClick: () => n(s),
				children: [/* @__PURE__ */ B(De, { size: 14 }), /* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: wt(s) }), /* @__PURE__ */ B("small", { children: "Double-click to isolate" })] })]
			}) : null,
			/* @__PURE__ */ B("div", {
				className: "vt-layer-list vt-easy-layer-list",
				children: c.map((t) => {
					let i = t === s ? 0 : Math.min(2, $r(t, s));
					return /* @__PURE__ */ V("button", {
						className: e === t ? "selected" : "",
						style: { paddingLeft: 12 + i * 14 },
						onClick: () => n(t),
						onDoubleClick: () => t.matches(Xr) && r(t),
						children: [
							/* @__PURE__ */ B(ce, {
								size: 11,
								className: "vt-easy-layer-arrow"
							}),
							/* @__PURE__ */ B("span", { children: wt(t) }),
							/* @__PURE__ */ B("code", { children: t.tagName.toLowerCase() })
						]
					}, H(t));
				})
			})
		]
	});
}
function $r(e, t) {
	let n = 0, r = e.parentElement;
	for (; r && r !== t;) n += 1, r = r.parentElement;
	return n;
}
//#endregion
//#region src/visual-truth/SelectionBreadcrumbs.tsx
function ei({ selected: e, onSelect: t, isolated: n, onExitIsolation: r }) {
	if (!e) return null;
	let i = [], a = e;
	for (; a && a !== document.body && i.length < 5;) a.matches("main, section, article, header, footer, nav, h1, h2, h3, p, a, button, img, div[data-vt-label]") && i.unshift(a), a = a.parentElement;
	return /* @__PURE__ */ V("nav", {
		className: "vt-breadcrumbs",
		"aria-label": "Selected element path",
		children: [n ? /* @__PURE__ */ V("button", {
			className: "vt-isolation-badge",
			onClick: r,
			children: [
				/* @__PURE__ */ B(ye, { size: 12 }),
				"Exit ",
				wt(n)
			]
		}) : null, i.map((n, r) => /* @__PURE__ */ V("span", { children: [r ? /* @__PURE__ */ B(ce, { size: 11 }) : null, /* @__PURE__ */ B("button", {
			className: n === e ? "current" : "",
			onClick: () => t(n),
			children: wt(n)
		})] }, `${n.tagName}-${r}`))]
	});
}
//#endregion
//#region src/visual-truth/CanvasControls.tsx
function ti({ zoom: e, panMode: t, isolated: n, onZoom: r, onFitPage: i, onFitSelection: a, onPanMode: o, onIsolate: s, onExitIsolation: c, sections: l }) {
	let u = Math.max(document.documentElement.scrollHeight, 1);
	return /* @__PURE__ */ V(z, { children: [/* @__PURE__ */ V("div", {
		className: "vt-canvas-controls",
		role: "toolbar",
		"aria-label": "Canvas navigation",
		children: [
			/* @__PURE__ */ B("button", {
				onClick: () => r(Math.max(.25, e - .1)),
				"aria-label": "Zoom out",
				children: /* @__PURE__ */ B(M, { size: 13 })
			}),
			/* @__PURE__ */ V("button", {
				className: "vt-zoom-value",
				onClick: () => r(1),
				title: "Reset zoom to 100%",
				children: [Math.round(e * 100), "%"]
			}),
			/* @__PURE__ */ B("button", {
				onClick: () => r(Math.min(2, e + .1)),
				"aria-label": "Zoom in",
				children: /* @__PURE__ */ B(Ze, { size: 13 })
			}),
			/* @__PURE__ */ B("i", {}),
			/* @__PURE__ */ B("button", {
				onClick: i,
				"aria-label": "Fit page",
				children: /* @__PURE__ */ B(Ge, { size: 13 })
			}),
			/* @__PURE__ */ B("button", {
				onClick: a,
				"aria-label": "Fit selection",
				children: /* @__PURE__ */ B(He, { size: 13 })
			}),
			/* @__PURE__ */ B("button", {
				className: t ? "active" : "",
				"aria-label": "Pan canvas",
				"aria-pressed": t,
				onClick: () => o(!t),
				children: /* @__PURE__ */ B(Me, { size: 13 })
			}),
			/* @__PURE__ */ B("button", {
				className: n ? "active" : "",
				"aria-label": n ? "Exit section isolation" : "Isolate selected section",
				"aria-pressed": !!n,
				onClick: n ? c : s,
				children: B(n ? nt : ut, { size: 13 })
			})
		]
	}), /* @__PURE__ */ V("div", {
		className: "vt-minimap",
		"aria-label": "Page minimap",
		children: [/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B(ye, { size: 11 }), /* @__PURE__ */ B("span", { children: "Page" })] }), /* @__PURE__ */ V("div", { children: [l.slice(0, 12).map((e, t) => {
			let n = e.getBoundingClientRect();
			return /* @__PURE__ */ B("button", {
				style: { height: Math.max(4, Math.min(24, n.height / u * 120)) },
				title: `Jump to section ${t + 1}`,
				onClick: () => e.scrollIntoView({
					behavior: "smooth",
					block: "center"
				})
			}, `${e.tagName}-${t}`);
		}), /* @__PURE__ */ B("i", { style: { top: `${Math.max(0, Math.min(90, window.scrollY / u * 100))}%` } })] })]
	})] });
}
//#endregion
//#region src/visual-truth/EasyLayoutHandles.tsx
function ni({ selected: e, metrics: t, onStyle: n }) {
	let r = e.getBoundingClientRect(), i = t.display.includes("flex") || t.display.includes("grid"), o = (e, r) => {
		r.preventDefault(), r.stopPropagation();
		let i = r.clientX, a = r.clientY, o = e === "gap" ? t.gap : e === "padding-top" ? t.paddingTop : e === "padding-right" ? t.paddingRight : e === "padding-bottom" ? t.paddingBottom : t.paddingLeft, s = e === "padding-left" || e === "padding-right" || e === "gap" && t.flexDirection !== "column", c = e === "padding-left" ? 1 : e === "padding-right" ? -1 : e === "padding-top" ? 1 : e === "padding-bottom" ? -1 : 1, l = (t) => {
			let r = s ? t.clientX - i : t.clientY - a;
			n(e, `${Math.max(0, Math.round(o + r * c))}px`);
		}, u = () => {
			window.removeEventListener("pointermove", l), window.removeEventListener("pointerup", u), window.removeEventListener("pointercancel", u);
		};
		window.addEventListener("pointermove", l), window.addEventListener("pointerup", u), window.addEventListener("pointercancel", u);
	};
	return /* @__PURE__ */ V("div", {
		className: "vt-layout-handles",
		style: {
			left: r.left,
			top: r.top,
			width: r.width,
			height: r.height
		},
		children: [
			/* @__PURE__ */ B("button", {
				className: "top",
				onPointerDown: (e) => o("padding-top", e),
				"aria-label": `Drag top padding, currently ${Math.round(t.paddingTop)} pixels`,
				children: /* @__PURE__ */ B(F, { size: 11 })
			}),
			/* @__PURE__ */ B("button", {
				className: "right",
				onPointerDown: (e) => o("padding-right", e),
				"aria-label": `Drag right padding, currently ${Math.round(t.paddingRight)} pixels`,
				children: /* @__PURE__ */ B(Ye, { size: 11 })
			}),
			/* @__PURE__ */ B("button", {
				className: "bottom",
				onPointerDown: (e) => o("padding-bottom", e),
				"aria-label": `Drag bottom padding, currently ${Math.round(t.paddingBottom)} pixels`,
				children: /* @__PURE__ */ B(F, { size: 11 })
			}),
			/* @__PURE__ */ B("button", {
				className: "left",
				onPointerDown: (e) => o("padding-left", e),
				"aria-label": `Drag left padding, currently ${Math.round(t.paddingLeft)} pixels`,
				children: /* @__PURE__ */ B(Ye, { size: 11 })
			}),
			i ? /* @__PURE__ */ V("div", {
				className: "vt-layout-center-tools",
				children: [
					/* @__PURE__ */ V("button", {
						onPointerDown: (e) => o("gap", e),
						"aria-label": `Drag gap, currently ${Math.round(t.gap)} pixels`,
						children: [/* @__PURE__ */ B(u, { size: 12 }), /* @__PURE__ */ B("span", { children: Math.round(t.gap) })]
					}),
					t.display === "grid" ? /* @__PURE__ */ V(z, { children: [/* @__PURE__ */ B("button", {
						onClick: () => n("grid-template-columns", "repeat(2, minmax(0, 1fr))"),
						"aria-label": "Set two equal columns",
						children: /* @__PURE__ */ B(fe, { size: 12 })
					}), /* @__PURE__ */ B("button", {
						onPointerDown: (e) => {
							e.preventDefault(), e.stopPropagation();
							let t = e.clientX, i = (e) => {
								n("grid-template-columns", `${Math.max(20, Math.min(80, 50 + (e.clientX - t) / Math.max(1, r.width) * 100)).toFixed(1)}% minmax(0, 1fr)`);
							}, a = () => {
								window.removeEventListener("pointermove", i), window.removeEventListener("pointerup", a), window.removeEventListener("pointercancel", a);
							};
							window.addEventListener("pointermove", i), window.addEventListener("pointerup", a), window.addEventListener("pointercancel", a);
						},
						"aria-label": "Drag grid column division",
						children: /* @__PURE__ */ B(Ye, { size: 12 })
					})] }) : null,
					/* @__PURE__ */ B("button", {
						onClick: () => n("align-items", "center"),
						"aria-label": "Center children",
						children: /* @__PURE__ */ B(a, { size: 12 })
					})
				]
			}) : null
		]
	});
}
//#endregion
//#region src/visual-truth/ComponentLibrary.tsx
function ri({ components: e, selected: t, onCreate: n, onInsert: r, onUpdate: i, onDelete: a, onClose: o }) {
	return /* @__PURE__ */ V("aside", {
		className: "vt-component-library",
		children: [
			/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B(re, { size: 16 }), /* @__PURE__ */ B("strong", { children: "Components" })] }), /* @__PURE__ */ B("button", {
				onClick: o,
				children: /* @__PURE__ */ B(bt, { size: 15 })
			})] }),
			/* @__PURE__ */ B("p", { children: "Save a card, button, header, or section and reuse linked instances." }),
			/* @__PURE__ */ V("button", {
				className: "vt-component-create",
				disabled: !t,
				onClick: n,
				children: [/* @__PURE__ */ B(he, { size: 14 }), "Create from selection"]
			}),
			/* @__PURE__ */ V("div", { children: [e.map((e) => /* @__PURE__ */ V("article", { children: [
				/* @__PURE__ */ B("span", { children: /* @__PURE__ */ B(re, { size: 15 }) }),
				/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: e.name }), /* @__PURE__ */ B("small", { children: new Date(e.createdAt).toLocaleDateString() })] }),
				/* @__PURE__ */ B("button", {
					onClick: () => r(e),
					children: "Insert"
				}),
				/* @__PURE__ */ B("button", {
					onClick: () => i(e),
					title: "Update every linked instance",
					children: /* @__PURE__ */ B($e, { size: 13 })
				}),
				/* @__PURE__ */ B("button", {
					onClick: () => a(e.id),
					title: "Delete component",
					children: /* @__PURE__ */ B(mt, { size: 13 })
				})
			] }, e.id)), e.length ? null : /* @__PURE__ */ B("div", {
				className: "vt-component-empty",
				children: "No reusable components yet."
			})] })
		]
	});
}
//#endregion
//#region src/visual-truth/ContentEditor.tsx
function ii({ selected: e, onAttribute: t, onText: n, onEditText: i, onClose: a }) {
	let o = r(null);
	if (!e) return /* @__PURE__ */ V("aside", {
		className: "vt-content-editor vt-easy-empty",
		children: [
			/* @__PURE__ */ B(ht, { size: 24 }),
			/* @__PURE__ */ B("strong", { children: "Select content" }),
			/* @__PURE__ */ B("p", { children: "Click text, a link, button, or image to replace its content." }),
			/* @__PURE__ */ B("button", {
				onClick: a,
				children: "Exit content mode"
			})
		]
	});
	let s = Nt(e), c = e.matches("img"), l = e.matches("a"), u = (e) => {
		if (!e) return;
		let n = new FileReader();
		n.onload = () => typeof n.result == "string" && t("src", n.result, `Replace image with "${e.name}"`), n.readAsDataURL(e);
	};
	return /* @__PURE__ */ V("aside", {
		className: "vt-content-editor",
		children: [
			/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B(ht, { size: 16 }), /* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: "Content" }), /* @__PURE__ */ B("small", { children: wt(e) })] })] }), /* @__PURE__ */ B("button", {
				onClick: a,
				children: /* @__PURE__ */ B(bt, { size: 15 })
			})] }),
			s ? /* @__PURE__ */ V("section", { children: [
				/* @__PURE__ */ B("label", { children: "Text" }),
				/* @__PURE__ */ B("textarea", {
					value: e.innerText,
					onChange: (e) => n(e.target.value)
				}),
				/* @__PURE__ */ V("button", {
					onClick: i,
					children: [/* @__PURE__ */ B(ht, { size: 14 }), "Edit directly on canvas"]
				})
			] }) : null,
			l ? /* @__PURE__ */ V("section", { children: [
				/* @__PURE__ */ B("label", { children: "Link destination" }),
				/* @__PURE__ */ V("div", {
					className: "vt-content-link",
					children: [/* @__PURE__ */ B(Ve, { size: 14 }), /* @__PURE__ */ B("input", {
						value: e.getAttribute("href") ?? "",
						onChange: (e) => t("href", e.target.value)
					})]
				}),
				/* @__PURE__ */ V("label", {
					className: "vt-content-checkbox",
					children: [/* @__PURE__ */ B("input", {
						type: "checkbox",
						checked: e.getAttribute("target") === "_blank",
						onChange: (e) => t("target", e.target.checked ? "_blank" : "")
					}), /* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B(we, { size: 13 }), "Open in new tab"] })]
				})
			] }) : null,
			c ? /* @__PURE__ */ V("section", { children: [
				/* @__PURE__ */ B("label", { children: "Image" }),
				/* @__PURE__ */ B("input", {
					ref: o,
					hidden: !0,
					type: "file",
					accept: "image/*",
					onChange: (e) => {
						u(e.target.files?.[0]), e.currentTarget.value = "";
					}
				}),
				/* @__PURE__ */ V("button", {
					onClick: () => o.current?.click(),
					children: [/* @__PURE__ */ B(Fe, { size: 14 }), "Replace image"]
				}),
				/* @__PURE__ */ B("label", { children: "Alt text" }),
				/* @__PURE__ */ B("textarea", {
					value: e.getAttribute("alt") ?? "",
					onChange: (e) => t("alt", e.target.value)
				})
			] }) : null
		]
	});
}
//#endregion
//#region src/visual-truth/WorkspacePresetControls.tsx
var ai = {
	duda: "Duda",
	squarespace: "Squarespace",
	elementor: "Elementor"
};
function oi({ value: e, onChange: t }) {
	return /* @__PURE__ */ V("label", {
		className: "vt-workspace-switcher",
		children: [/* @__PURE__ */ B("span", { children: "Workspace" }), /* @__PURE__ */ B("select", {
			"aria-label": "Workspace preset",
			value: e,
			onChange: (e) => t(e.target.value),
			children: Object.keys(ai).map((e) => /* @__PURE__ */ B("option", {
				value: e,
				children: ai[e]
			}, e))
		})]
	});
}
var si = [
	{
		id: "add",
		label: "Add",
		icon: y
	},
	{
		id: "pages",
		label: "Pages",
		icon: Ee
	},
	{
		id: "layers",
		label: "Layers",
		icon: Le
	},
	{
		id: "theme",
		label: "Theme",
		icon: Xe
	},
	{
		id: "content",
		label: "CMS",
		icon: ft
	},
	{
		id: "seo",
		label: "SEO",
		icon: rt
	},
	{
		id: "more",
		label: "More",
		icon: N
	}
];
function ci({ preset: e, activeTool: t, onTool: n, onDisplayMenu: r }) {
	return e === "duda" ? /* @__PURE__ */ V("nav", {
		className: "vt-workspace-rail",
		"aria-label": "Duda workspace tools",
		"data-visual-truth-ui": !0,
		onContextMenu: r,
		children: [
			si.map(({ id: e, label: r, icon: i }) => /* @__PURE__ */ V("button", {
				className: t === e ? "active" : "",
				"aria-current": t === e ? "page" : void 0,
				onClick: () => n(e),
				children: [/* @__PURE__ */ B(i, { size: 17 }), /* @__PURE__ */ B("span", { children: r })]
			}, e)),
			/* @__PURE__ */ B("div", { "aria-hidden": "true" }),
			/* @__PURE__ */ V("button", {
				onClick: () => n("theme"),
				children: [/* @__PURE__ */ B(lt, { size: 17 }), /* @__PURE__ */ B("span", { children: "Checks" })]
			}),
			/* @__PURE__ */ V("button", {
				onClick: r,
				children: [/* @__PURE__ */ B(at, { size: 17 }), /* @__PURE__ */ B("span", { children: "Settings" })]
			})
		]
	}) : null;
}
//#endregion
//#region src/visual-truth/ToolbarDisplayMenu.tsx
function li({ position: e, labelsShown: n, hoverHints: i, onLabelsShown: a, onHoverHints: o, onFeedback: s, onClose: c }) {
	let l = r(null), u = Math.max(8, Math.min(window.innerWidth - 268 - 8, e.x)), d = Math.max(8, Math.min(window.innerHeight - 248 - 8, e.y));
	return t(() => {
		l.current?.focus();
	}, []), /* @__PURE__ */ V("div", {
		ref: l,
		className: "vt-toolbar-display-menu",
		"data-visual-truth-ui": !0,
		role: "menu",
		"aria-label": "Toolbar settings and help",
		tabIndex: -1,
		style: {
			left: u,
			top: d
		},
		onKeyDown: (e) => {
			e.key === "Escape" && c();
		},
		children: [
			/* @__PURE__ */ V("header", { children: [/* @__PURE__ */ B("span", { children: /* @__PURE__ */ B(Je, { size: 15 }) }), /* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: "Toolbar & help" }), /* @__PURE__ */ B("small", { children: "Adjust the workspace or share feedback." })] })] }),
			/* @__PURE__ */ V("button", {
				className: "vt-toolbar-display-row",
				role: "menuitemcheckbox",
				"aria-checked": n,
				onClick: () => a(!n),
				children: [/* @__PURE__ */ B("span", {
					className: n ? "checked" : "",
					children: n ? /* @__PURE__ */ B(ie, { size: 13 }) : null
				}), /* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: "Show icon labels" }), /* @__PURE__ */ B("small", { children: "Display names below toolbar icons." })] })]
			}),
			/* @__PURE__ */ V("label", {
				className: "vt-toolbar-display-toggle",
				children: [
					/* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B("strong", { children: "Use hover hints" }), /* @__PURE__ */ B("small", { children: "Show a description when you pause." })] }),
					/* @__PURE__ */ B("input", {
						type: "checkbox",
						checked: i,
						onChange: (e) => o(e.target.checked)
					}),
					/* @__PURE__ */ B("i", { "aria-hidden": "true" })
				]
			}),
			/* @__PURE__ */ V("button", {
				className: "vt-toolbar-feedback-row",
				role: "menuitem",
				onClick: () => {
					s(), c();
				},
				children: [/* @__PURE__ */ B("span", { children: /* @__PURE__ */ B(j, { size: 14 }) }), /* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("strong", { children: "Send feedback" }), /* @__PURE__ */ B("small", { children: "Open the optional privacy-first form." })] })]
			}),
			/* @__PURE__ */ V("footer", { children: [/* @__PURE__ */ B(D, { size: 12 }), "Right-click the toolbar to change this anytime."] })
		]
	});
}
//#endregion
//#region src/visual-truth/VisualTruth.tsx
var ui = [
	"color",
	"background-color",
	"font-family",
	"font-size",
	"font-weight",
	"font-style",
	"text-decoration",
	"text-align",
	"line-height",
	"letter-spacing",
	"border",
	"border-radius",
	"box-shadow",
	"opacity",
	"translate"
], di = [
	"color",
	"background-color",
	"border-color",
	"border-width",
	"border-radius",
	"opacity",
	"box-shadow"
], fi = /* @__PURE__ */ new Set([
	"margin-top",
	"margin-right",
	"margin-bottom",
	"margin-left",
	"padding-top",
	"padding-right",
	"padding-bottom",
	"padding-left",
	"gap"
]), pi = 1, mi = "https://visual-truth-editor.deriquehanche.chatgpt.site/feedback?version=1.3.0&source=editor", hi = "visual-truth:feedback-session-count:v1", gi = "visual-truth:feedback-session-counted:v1", _i = "visual-truth:feedback-remind-after:v1", vi = "visual-truth:feedback-completed:v1", yi = "visual-truth:feedback-disabled:v1", bi = () => `visual-truth:components:v1:${window.location.pathname}`, xi = () => `visual-truth:change-sessions:v1:${window.location.pathname}`, Si = () => `visual-truth:ruler-guides:v1:${window.location.pathname}`;
function Ci() {
	try {
		let e = JSON.parse(window.localStorage.getItem(bi()) ?? "[]");
		return Array.isArray(e) ? e : [];
	} catch {
		return [];
	}
}
function wi() {
	try {
		let e = JSON.parse(window.localStorage.getItem(xi()) ?? "[]");
		return Array.isArray(e) ? e : [];
	} catch {
		return [];
	}
}
function Ti() {
	try {
		let e = JSON.parse(window.localStorage.getItem(Si()) ?? "[]");
		return Array.isArray(e) ? e.filter((e) => typeof e?.id == "string" && (e.axis === "x" || e.axis === "y") && typeof e.position == "number" && Number.isFinite(e.position)) : [];
	} catch {
		return [];
	}
}
function Ei() {
	return `visual-truth:${window.location.pathname}`;
}
function Di(e) {
	return fi.has(e);
}
function Oi(e) {
	if (e) return {
		version: pi,
		changes: [],
		redoStack: [],
		note: "",
		checkpoints: []
	};
	try {
		let e = JSON.parse(window.localStorage.getItem(Ei()) ?? "");
		if (e.version === pi && Array.isArray(e.changes)) return e;
	} catch {}
	return {
		version: pi,
		changes: [],
		redoStack: [],
		note: "",
		checkpoints: []
	};
}
function ki(e, t, n = 6) {
	let r = null;
	for (let i of e) for (let e of t) {
		let t = e - i;
		Math.abs(t) > n || (!r || Math.abs(t) < Math.abs(r.adjustment)) && (r = {
			adjustment: t,
			guide: e
		});
	}
	return r;
}
function Ai(e, t) {
	let n = Math.round(e), r = Math.round(t);
	return n === 0 && r === 0 ? "none" : `${n}px ${r}px`;
}
function ji(e) {
	return e.type.startsWith("image/") ? e.size > 2e6 ? Promise.reject(/* @__PURE__ */ Error("Choose an image under 2 MB so it can be saved locally.")) : new Promise((t, n) => {
		let r = new FileReader();
		r.onload = () => typeof r.result == "string" ? t(r.result) : n(/* @__PURE__ */ Error("That image could not be read.")), r.onerror = () => n(/* @__PURE__ */ Error("That image could not be read.")), r.readAsDataURL(e);
	}) : Promise.reject(/* @__PURE__ */ Error("Drop or paste an image file."));
}
function Mi(e) {
	let t = (e.innerText || e.textContent || "").trim().split(/\s+/).filter(Boolean);
	if (!t.length) return 48;
	let n = getComputedStyle(e), r = document.createElement("span");
	Object.assign(r.style, {
		position: "fixed",
		left: "-10000px",
		top: "0",
		visibility: "hidden",
		whiteSpace: "nowrap",
		fontFamily: n.fontFamily,
		fontSize: n.fontSize,
		fontWeight: n.fontWeight,
		fontStyle: n.fontStyle,
		fontStretch: n.fontStretch,
		letterSpacing: n.letterSpacing,
		textTransform: n.textTransform
	}), document.body.appendChild(r);
	let i = 0;
	for (let e of t) r.textContent = e, i = Math.max(i, r.getBoundingClientRect().width);
	r.remove();
	let a = Number.parseFloat(n.paddingLeft) + Number.parseFloat(n.paddingRight) + Number.parseFloat(n.borderLeftWidth) + Number.parseFloat(n.borderRightWidth);
	return Math.max(48, Math.ceil(i + (Number.isFinite(a) ? a : 0) + 1));
}
function Ni(e) {
	if (e.length < 2) return e;
	let t = crypto.randomUUID();
	return e.map((e) => ({
		...e,
		groupId: t
	}));
}
function Pi(e) {
	let t = e.at(-1);
	if (!t) return [];
	if (!t.groupId) return [t];
	let n = e.length - 1;
	for (; n > 0 && e[n - 1].groupId === t.groupId;) --n;
	return e.slice(n);
}
function Fi(e, t) {
	let n = e.at(-1);
	if (!(n && !n.groupId && !t.groupId && (t.kind === "style" || t.kind === "responsive-style") && n.kind === t.kind && n.selector === t.selector && n.property === t.property && n.device === t.device && t.timestamp - n.timestamp < 700)) return [...e, t];
	let r = n.previousRuntimeValue ?? n.previousValue;
	return (t.runtimeValue ?? t.value) === r ? e.slice(0, -1) : [...e.slice(0, -1), {
		...t,
		id: n.id,
		previousValue: n.previousValue,
		previousRuntimeValue: n.previousRuntimeValue
	}];
}
function Ii(e) {
	let t = H(e);
	return !e.id && !e.dataset.vtLabel && !e.dataset.vtId && (e.dataset.vtId = crypto.randomUUID()), t;
}
var Li = "visual-truth:layers-width:v1", Ri = "visual-truth:text-drag-behavior:v1", zi = "visual-truth:workspace-preset:v1", Bi = "visual-truth:toolbar-labels:v1", Vi = "visual-truth:toolbar-hints:v1", Hi = 220, Ui = (e) => Math.min(360, Math.max(180, typeof e == "number" && Number.isFinite(e) ? e : Hi)), Wi = () => {
	if (typeof window > "u") return Hi;
	try {
		let e = window.localStorage.getItem(Li);
		return e === null ? Hi : Ui(Number(e));
	} catch {
		return Hi;
	}
}, Gi = "visual-truth:grid-preferences:v1", Ki = () => {
	if (typeof window > "u") return {
		visible: !1,
		rulers: !0,
		rulerUnit: "px",
		magnetic: !0,
		snapToGrid: !0,
		size: 8
	};
	try {
		let e = JSON.parse(window.localStorage.getItem(Gi) ?? "{}");
		return {
			visible: e.visible === !0,
			rulers: e.rulers !== !1,
			rulerUnit: e.rulerUnit === "in" ? "in" : "px",
			magnetic: e.magnetic !== !1,
			snapToGrid: e.snapToGrid !== !1,
			size: [
				4,
				8,
				12,
				16
			].includes(e.size ?? 0) ? e.size : 8
		};
	} catch {
		return {
			visible: !1,
			rulers: !0,
			rulerUnit: "px",
			magnetic: !0,
			snapToGrid: !0,
			size: 8
		};
	}
}, qi = () => {
	if (typeof window > "u") return "scale";
	try {
		return window.localStorage.getItem(Ri) === "reflow" ? "reflow" : "scale";
	} catch {
		return "scale";
	}
}, Ji = () => {
	if (typeof window > "u") return "duda";
	let e = window.localStorage.getItem(zi);
	return e === "squarespace" || e === "elementor" ? e : "duda";
}, Yi = (e, t) => {
	if (typeof window > "u") return t;
	try {
		let n = window.localStorage.getItem(e);
		return n === null ? t : n === "true";
	} catch {
		return t;
	}
};
function Xi() {
	let e = document.querySelector("[data-visual-truth-host]");
	if (!e) return () => void 0;
	e.setAttribute("popover", "manual");
	try {
		typeof e.showPopover == "function" && !e.matches(":popover-open") && e.showPopover();
	} catch {}
	return () => {
		try {
			typeof e.hidePopover == "function" && e.matches(":popover-open") && e.hidePopover();
		} catch {}
	};
}
function Zi(e) {
	let t = e.closest("[data-visual-truth-host]");
	for (let n of [
		"#root",
		"#__next",
		"#app"
	]) {
		let r = document.querySelector(n);
		if (r && r !== t && !r.contains(e)) return r;
	}
	let n = e.parentElement;
	return n && n !== document.body && n !== t ? n : [...document.body.children].find((e) => e instanceof HTMLElement && e !== t && !e.matches("script, style, link, [data-visual-truth-host], [data-visual-truth-ui]")) ?? null;
}
function Qi({ defaultOpen: n = !1 }) {
	let a = typeof window < "u" && (window.self !== window.top || new URLSearchParams(window.location.search).has("vt-preview-frame")), [o] = i(() => Oi(a)), [s] = i(Ki), [c, l] = i(n), [u, d] = i(!0), [f, p] = i(!0), [m, ee] = i(!1), [h, te] = i(Wi), [g, _] = i(!1), [v, y] = i(() => window.localStorage.getItem("visual-truth:editor-mode") === "advanced" ? "advanced" : "easy"), [b, ne] = i(Ji), [ae, oe] = i("layers"), [se, x] = i(() => Yi(Bi, !1)), [S, le] = i(() => Yi(Vi, !0)), [ue, de] = i(null), [C, w] = i(qi), [fe, pe] = i(!1), [T, he] = i(() => /* @__PURE__ */ new Set()), [ge, _e] = i(!1), [ve, ye] = i(!1), [be, xe] = i(!1), [Se, Ce] = i(!1), [we, E] = i(1), [Te, Ee] = i(!1), [De, Oe] = i(null), [Ae, je] = i(Ci), [Me, Ne] = i(wi), [Pe, D] = i(Ti), [Ie, Re] = i(!1), [ze, Be] = i(() => Number(window.localStorage.getItem("visual-truth:onboarding-step") ?? 0)), [Ve, O] = i(!1), [k, He] = i("inside"), [Ue, Ge] = i("design"), [A, j] = i(null), [M, Ke] = i([]), [N, Je] = i(null), [P, Ye] = i(null), [F, I] = i(o.changes), [Xe, L] = i(o.redoStack ?? []), [$e, et] = i(o.checkpoints ?? []), [tt, nt] = i(1), [rt, it] = i(!1), [at, ot] = i(!1), [ct, ut] = i(o.note ?? ""), [dt, ft] = i(null), [pt, mt] = i(null), [gt, vt] = i({}), [R, yt] = i("all"), [z, Tt] = i(!1), [U, It] = i(!1), [W, G] = i(null), [Rt, zt] = i(null), [Bt, Vt] = i({
		x: null,
		y: null
	}), [Ht, Ut] = i(null), [Wt, Gt] = i(null), [Kt, qt] = i(""), [Jt, Yt] = i(s.visible), [Xt, Zt] = i(s.rulers), [Qt, $t] = i(s.rulerUnit), [en, tn] = i(s.magnetic), [rn, an] = i(s.snapToGrid), [on, sn] = i(s.size), [cn, ln] = i(!1), [un, fn] = i(gr), [pn, mn] = i(vr), [vn, yn] = i(br), [bn, xn] = i(a ? { status: "idle" } : {
		status: "checking",
		message: "Checking local source bridge..."
	}), Sn = r(null), Cn = r(!1), En = r(!1), Dn = r(null), On = r(null), kn = r(null), An = r(null), jn = r(!1), Mn = r(null), Nn = r({
		layers: !0,
		right: !0
	}), Pn = r(!1), [Fn, In] = i(!1);
	t(() => {
		window.localStorage.setItem("visual-truth:editor-mode", v);
	}, [v]), t(() => {
		window.localStorage.setItem(zi, b);
	}, [b]), t(() => {
		try {
			window.localStorage.setItem(Bi, String(se));
		} catch {}
	}, [se]), t(() => {
		try {
			window.localStorage.setItem(Vi, String(S));
		} catch {}
	}, [S]), t(() => {
		try {
			window.localStorage.setItem(Ri, C);
		} catch {}
	}, [C]), t(() => {
		if (a || !c) return;
		let e = Number(window.localStorage.getItem(hi) ?? 0);
		try {
			window.sessionStorage.getItem(gi) || (e += 1, window.localStorage.setItem(hi, String(e)), window.sessionStorage.setItem(gi, "true"));
		} catch {
			return;
		}
		if (ze < 3 || window.localStorage.getItem(vi) === "true" || window.localStorage.getItem(yi) === "true") return;
		let t = Number(window.localStorage.getItem(_i) ?? 3);
		if (e < Math.max(3, t)) return;
		let n = window.setTimeout(() => O(!0), 4200);
		return () => window.clearTimeout(n);
	}, [
		a,
		ze,
		c
	]), t(() => {
		if (!a) return Xi();
	}, [a]), t(() => {
		window.localStorage.setItem(bi(), JSON.stringify(Ae));
	}, [Ae]), t(() => {
		window.localStorage.setItem(xi(), JSON.stringify(Me));
	}, [Me]), t(() => {
		window.localStorage.setItem(Si(), JSON.stringify(Pe));
	}, [Pe]), t(() => {
		let e = (e) => {
			(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && (e.preventDefault(), _e(!0)), e.key === "Escape" && _e(!1);
		};
		return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
	}, []);
	let Ln = e(() => {
		if (u || f) {
			Nn.current = {
				layers: u,
				right: f
			}, d(!1), p(!1);
			return;
		}
		d(Nn.current.layers), p(Nn.current.right);
	}, [u, f]);
	t(() => {
		if (a) return;
		let e = () => {
			let e = window.innerWidth > 680 && window.innerWidth <= 1100;
			e && !Pn.current ? (Pn.current = !0, Nn.current = {
				layers: u,
				right: f
			}, d(!1)) : !e && Pn.current && (Pn.current = !1, d(Nn.current.layers), p(Nn.current.right));
		};
		return e(), window.addEventListener("resize", e), () => window.removeEventListener("resize", e);
	}, [
		a,
		u,
		f
	]), t(() => _r(un), [un]), t(() => yr(pn), [pn]), t(() => xr(vn), [vn]), t(() => {
		if (a || !c || dt) return;
		let e = document.querySelector(".vt-root"), t = e ? Zi(e) : null;
		if (!t || t === document.body) return;
		let n = window.scrollX, r = window.scrollY;
		document.documentElement.classList.add("vt-workspace-active"), t.setAttribute("data-vt-workspace-canvas", "true");
		let i = window.requestAnimationFrame(() => {
			t.scrollTop = r;
		});
		return () => {
			let e = t.scrollTop;
			window.cancelAnimationFrame(i), t.removeAttribute("data-vt-workspace-canvas"), document.documentElement.classList.remove("vt-workspace-active");
			for (let e of [
				"--vt-workspace-left",
				"--vt-workspace-right",
				"--vt-workspace-top",
				"--vt-workspace-bottom",
				"--vt-ruler-size"
			]) document.documentElement.style.removeProperty(e);
			window.requestAnimationFrame(() => window.scrollTo(n, e));
		};
	}, [
		a,
		c,
		dt
	]), t(() => {
		if (a || !c || dt) return;
		let e = 0, t = () => {
			let t = window.innerWidth > 680 && window.innerWidth <= 1100, n = m ? [] : [...document.querySelectorAll(".vt-workspace-rail, .vt-layers, .vt-elements, .vt-studio, .vt-inspector, .vt-easy-inspector, .vt-review-panel, .vt-assist-panel, .vt-content-editor, .vt-component-library")].map((e) => e.getBoundingClientRect()).filter((e) => e.width > 0 && e.height > 0), r = n.reduce((e, t) => t.left < window.innerWidth / 2 && t.right <= window.innerWidth * .6 ? Math.max(e, t.right) : e, 0), i = n.reduce((e, t) => t.left >= window.innerWidth * .4 ? Math.max(e, window.innerWidth - t.left) : e, 0), a = n.find((e) => e.left >= window.innerWidth * .4);
			document.documentElement.style.setProperty("--vt-workspace-left", `${t ? 0 : r}px`), document.documentElement.style.setProperty("--vt-workspace-right", `${t ? 0 : i}px`);
			let o = document.querySelector(".vt-toolbar")?.getBoundingClientRect().height ?? 64;
			document.documentElement.style.setProperty("--vt-workspace-top", m ? "0px" : `${o}px`), document.documentElement.style.setProperty("--vt-workspace-bottom", m || v === "easy" ? "0px" : t ? `${a?.height ?? 0}px` : "34px"), document.documentElement.style.setProperty("--vt-ruler-size", !m && v === "advanced" && Xt ? "24px" : "0px"), window.cancelAnimationFrame(e), e = window.requestAnimationFrame(() => {
				A && document.contains(A) && Ye(Dt(A));
			});
		}, n = new ResizeObserver(t), r = window.requestAnimationFrame(() => {
			t(), document.querySelectorAll(".vt-toolbar, .vt-workspace-rail, .vt-layers, .vt-elements, .vt-studio, .vt-inspector, .vt-easy-inspector, .vt-review-panel, .vt-assist-panel, .vt-content-editor, .vt-component-library").forEach((e) => n.observe(e));
		});
		return window.addEventListener("resize", t), () => {
			window.cancelAnimationFrame(r), window.cancelAnimationFrame(e), n.disconnect(), window.removeEventListener("resize", t);
		};
	}, [
		a,
		c,
		dt,
		u,
		g,
		cn,
		f,
		m,
		Xt,
		A,
		v,
		fe,
		ve,
		be,
		Se,
		b,
		se
	]), t(() => {
		a || bn.status !== "checking" || fetch("/__visual_truth_apply").then(async (e) => {
			let t = await e.json();
			if (!e.ok || !t.available) throw Error("Install the Visual Truth Vite bridge to enable source writing.");
			xn({
				status: "ready",
				file: t.output,
				message: "Ready to write source"
			});
		}).catch((e) => xn({
			status: "error",
			message: e instanceof Error ? e.message : "Source bridge unavailable."
		}));
	}, [a, bn.status]), t(() => {
		try {
			window.localStorage.setItem(Gi, JSON.stringify({
				visible: Jt,
				rulers: Xt,
				rulerUnit: Qt,
				magnetic: en,
				snapToGrid: rn,
				size: on
			}));
		} catch {}
	}, [
		Jt,
		Xt,
		Qt,
		en,
		rn,
		on
	]), t(() => {
		let e = document.querySelector("[data-vt-workspace-canvas=\"true\"]");
		if (e) return e.style.setProperty("--vt-canvas-zoom", String(we)), e.dataset.vtCanvasZoom = String(we), () => {
			e.style.removeProperty("--vt-canvas-zoom"), delete e.dataset.vtCanvasZoom;
		};
	}, [we, c]), t(() => {
		let e = document.querySelector("[data-vt-workspace-canvas=\"true\"]");
		if (!e || !Te) return;
		e.dataset.vtPanMode = "true";
		let t = (t) => {
			if (xt(t.target) || t.button !== 0) return;
			t.preventDefault();
			let n = t.clientX, r = t.clientY, i = e.scrollLeft, a = e.scrollTop, o = (t) => {
				e.scrollLeft = i - (t.clientX - n), e.scrollTop = a - (t.clientY - r);
			}, s = () => {
				window.removeEventListener("pointermove", o), window.removeEventListener("pointerup", s), window.removeEventListener("pointercancel", s);
			};
			window.addEventListener("pointermove", o), window.addEventListener("pointerup", s), window.addEventListener("pointercancel", s);
		};
		return e.addEventListener("pointerdown", t, !0), () => {
			delete e.dataset.vtPanMode, e.removeEventListener("pointerdown", t, !0);
		};
	}, [Te, c]), t(() => {
		if (document.querySelectorAll("[data-vt-isolation-hidden]").forEach((e) => delete e.dataset.vtIsolationHidden), !De || !document.contains(De)) return;
		De.dataset.vtIsolated = "true";
		let e = De, t = document.querySelector("[data-vt-workspace-canvas=\"true\"]");
		for (; e.parentElement && e.parentElement !== t && e.parentElement !== document.body;) {
			let t = e.parentElement;
			[...t.children].forEach((t) => {
				t !== e && t instanceof HTMLElement && !t.matches(".vt-root") && (t.dataset.vtIsolationHidden = "true");
			}), e = t;
		}
		return () => {
			delete De.dataset.vtIsolated, document.querySelectorAll("[data-vt-isolation-hidden]").forEach((e) => delete e.dataset.vtIsolationHidden);
		};
	}, [De]);
	let K = A?.closest("[data-vt-repeater-template]") ?? null, Rn = vn.find((e) => e.id === K?.dataset.vtRepeaterTemplate) ?? null;
	t(() => {
		try {
			window.localStorage.setItem(Li, String(Ui(h)));
		} catch {}
	}, [h]), t(() => {
		if (!a) return;
		let e = (e) => {
			if (e.source !== window.parent || e.data?.type !== "visual-truth:preview-sync") return;
			let t = Array.isArray(e.data.changes) ? e.data.changes : [], n = typeof e.data.selectedSelector == "string" ? e.data.selectedSelector : "";
			gn(document, t), document.querySelectorAll("[data-vt-preview-selected]").forEach((e) => e.removeAttribute("data-vt-preview-selected"));
			let r = document.getElementById("visual-truth-preview-selection");
			r || (r = document.createElement("style"), r.id = "visual-truth-preview-selection", r.textContent = "[data-vt-preview-selected]{outline:3px solid #2684ff!important;outline-offset:2px!important;}", document.head.appendChild(r));
			let i = n ? document.querySelector(n) : null;
			i?.setAttribute("data-vt-preview-selected", "true"), window.requestAnimationFrame(() => {
				let t = i?.getBoundingClientRect();
				window.parent.postMessage({
					type: "visual-truth:preview-measurement",
					frameId: e.data.frameId,
					measurement: t ? {
						x: Math.round(t.x),
						y: Math.round(t.y),
						width: Math.round(t.width),
						height: Math.round(t.height)
					} : null
				}, "*");
			});
		};
		return window.addEventListener("message", e), window.parent.postMessage({ type: "visual-truth:preview-ready" }, "*"), () => window.removeEventListener("message", e);
	}, [a]), t(() => {
		if (a || jn.current || (jn.current = !0, !F.length)) return;
		let e = 0, t = () => {
			gn(document, F), e += 1, e < 3 ? window.requestAnimationFrame(t) : nt((e) => e + 1);
		};
		window.requestAnimationFrame(t);
	}, [F, a]), t(() => {
		if (a) return;
		let e = !1;
		try {
			window.localStorage.setItem(Ei(), JSON.stringify({
				version: pi,
				changes: F,
				redoStack: Xe,
				note: ct,
				checkpoints: $e
			}));
		} catch {
			e = !0;
		}
		let t = window.requestAnimationFrame(() => ot(e));
		return () => window.cancelAnimationFrame(t);
	}, [
		F,
		Xe,
		ct,
		$e,
		a
	]);
	let q = e(() => {
		A && document.contains(A) && Ye(Dt(A)), nt((e) => e + 1);
	}, [A]), zn = e((e) => {
		On.current !== null && window.clearTimeout(On.current), Ut(e), On.current = window.setTimeout(() => {
			Ut(null), On.current = null;
		}, 900);
	}, []);
	t(() => () => {
		On.current !== null && window.clearTimeout(On.current);
	}, []), t(() => {
		if (a) return;
		_n(document, F);
		let e = window.requestAnimationFrame(() => {
			A && document.contains(A) && Ye(Dt(A)), nt((e) => e + 1);
		});
		return () => window.cancelAnimationFrame(e);
	}, [
		F,
		A,
		a
	]);
	let J = e((e, t = !1) => {
		if (!e || e === document.body || e === document.documentElement) return;
		let n = t ? "" : e.dataset.vtGroup, r = n ? [...document.querySelectorAll(`[data-vt-group="${CSS.escape(n)}"]`)] : [], i = M.filter((e) => document.contains(e)), a = r.length > 1 ? r : t ? i.includes(e) ? i.filter((t) => t !== e) : [...i, e] : [e], o = a.length ? a : [e], s = o.includes(e) ? e : o.at(-1) ?? e;
		Ke(o), j(s), Je(null), vt({}), Ye(Dt(s)), Ge("design"), G(null);
	}, [M]);
	t(() => {
		if (!c || U || Wt) return;
		let e = (e) => {
			if (xt(e.target)) {
				Je(null);
				return;
			}
			let t = St(e.target);
			Je(t && t !== A ? t : null);
		}, t = (e) => {
			e.relatedTarget || Je(null);
		};
		return document.addEventListener("mouseover", e, !0), document.addEventListener("mouseout", t, !0), () => {
			document.removeEventListener("mouseover", e, !0), document.removeEventListener("mouseout", t, !0);
		};
	}, [
		c,
		U,
		Wt,
		A
	]), t(() => {
		let e = window.requestAnimationFrame(() => nt((e) => e + 1));
		return () => window.cancelAnimationFrame(e);
	}, []), t(() => {
		if (!c) return;
		let e = (e) => {
			if (xt(e.target)) return;
			if (En.current) {
				En.current = !1, e.preventDefault(), e.stopPropagation();
				return;
			}
			if (U && A?.contains(e.target)) return;
			let t = St(e.target);
			Se && t && (t = t.closest("h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, blockquote, figcaption, img") ?? null), t && (t.closest("[data-vt-locked=\"true\"]") || (e.preventDefault(), e.stopPropagation(), J(t, e.shiftKey)));
		};
		return document.addEventListener("click", e, !0), () => document.removeEventListener("click", e, !0);
	}, [
		c,
		J,
		U,
		A,
		Se
	]), t(() => {
		if (!c || U) return;
		let e = (e) => {
			if (xt(e.target)) return;
			let t = St(e.target);
			t && (e.preventDefault(), e.stopPropagation(), M.includes(t) ? (j(t), Ye(Dt(t))) : J(t), G({
				x: e.clientX,
				y: e.clientY
			}));
		};
		return document.addEventListener("contextmenu", e, !0), () => document.removeEventListener("contextmenu", e, !0);
	}, [
		c,
		U,
		J,
		M
	]), t(() => {
		if (!W) return;
		let e = (e) => {
			e.target instanceof Element && e.target.closest(".vt-context-menu") || G(null);
		};
		return document.addEventListener("pointerdown", e, !0), () => document.removeEventListener("pointerdown", e, !0);
	}, [W]), t(() => {
		if (!ue) return;
		let e = (e) => {
			e.target instanceof Element && e.target.closest(".vt-toolbar-display-menu") || de(null);
		};
		return document.addEventListener("pointerdown", e, !0), () => document.removeEventListener("pointerdown", e, !0);
	}, [ue]);
	let Bn = e((e) => {
		e.preventDefault(), e.stopPropagation(), G(null), de({
			x: e.clientX,
			y: e.clientY
		});
	}, []), Vn = e((e = !1) => {
		if (e) {
			try {
				window.localStorage.setItem(vi, "true");
			} catch {}
			O(!1);
		}
		window.open(mi, "_blank", "noopener,noreferrer");
	}, []), Hn = e(() => {
		try {
			let e = Number(window.localStorage.getItem(hi) ?? 3);
			window.localStorage.setItem(_i, String(Math.max(3, e) + 3));
		} catch {}
		O(!1);
	}, []), Un = e(() => {
		try {
			window.localStorage.setItem(yi, "true");
		} catch {}
		O(!1);
	}, []);
	t(() => {
		if (kn.current?.disconnect(), !A) return;
		let e = new ResizeObserver(q);
		return e.observe(A), kn.current = e, window.addEventListener("scroll", q, !0), window.addEventListener("resize", q), () => {
			e.disconnect(), window.removeEventListener("scroll", q, !0), window.removeEventListener("resize", q);
		};
	}, [A, q]);
	let Gn = e((e, t, n, r, i, a) => {
		if (R === "all") return;
		let o = H(e);
		I((s) => {
			let c = [...s].reverse().find((e) => e.kind === "responsive-style" && e.device === R && e.selector === o && e.property === t), l = c?.runtimeValue ?? c?.value ?? n;
			if (l === r) return s;
			let u = At(e, t, l, r, R, i);
			return Fi(s, a ? {
				...u,
				groupId: a
			} : u);
		}), L([]);
	}, [R]), qn = e((e, t, n, r = !0, i) => {
		let a = e.style.getPropertyValue(t) || getComputedStyle(e).getPropertyValue(t);
		if (r && R !== "all") {
			Gn(e, t, a, n, i), q();
			return;
		}
		e.style.setProperty(t, n), r && a !== n && (I((r) => Fi(r, kt(e, t, a, n, i))), L([])), q();
	}, [
		R,
		Gn,
		q
	]), Y = e((e, t, n = !0, r) => {
		if (!A) return;
		let i = getComputedStyle(A), a = e === "font-size" ? Number.parseFloat(i.fontSize) : NaN, o = Di(e) ? e : null, s = di.includes(e) ? e : null, c = o ? Number.parseFloat(i.getPropertyValue(o)) || 0 : NaN, l = s ? i.getPropertyValue(s) : "";
		if ((o || s) && R !== "all") {
			let e = H(A), t = [...F].reverse().find((t) => t.kind === "responsive-style" && t.device === R && t.selector === e && t.property === (o ?? s)), n = t?.runtimeValue ?? t?.value;
			if (o) {
				let e = Number.parseFloat(n ?? "");
				Number.isFinite(e) && (c = e);
			} else s && n !== void 0 && (l = n);
		}
		if (qn(A, e, t, n, r), e === "font-size") {
			let e = Number.parseFloat(t), n = e - a;
			Number.isFinite(e) && Number.isFinite(n) && Math.abs(n) >= .05 && zn({
				kind: "type",
				fontSize: e,
				delta: n
			});
		}
		if (o) {
			let e = Number.parseFloat(t), n = e - c;
			Number.isFinite(e) && Number.isFinite(n) && Math.abs(n) >= .05 && zn({
				kind: "spacing",
				property: o,
				value: e,
				delta: n
			});
		}
		if (s && l !== t) {
			let e;
			(s === "border-width" || s === "border-radius") && (e = Number.parseFloat(t) - (Number.parseFloat(l) || 0)), s === "opacity" && (e = (Number.parseFloat(t) - (Number.parseFloat(l) || 0)) * 100), zn({
				kind: "appearance",
				property: s,
				value: t,
				previous: l,
				delta: Number.isFinite(e) && Math.abs(e ?? 0) >= .05 ? e : void 0
			});
		}
	}, [
		A,
		R,
		F,
		qn,
		zn
	]), Jn = e((e, t, n) => {
		Y(e, t, !0, n);
	}, [Y]), Xn = e((e) => {
		if (!A) return;
		let t = getComputedStyle(A), n = Object.entries(e), r = new Map(n.map(([e]) => [e, A.style.getPropertyValue(e) || t.getPropertyValue(e)]));
		if (R !== "all") {
			let e = n.length > 1 ? crypto.randomUUID() : void 0;
			for (let [t, i] of n) Gn(A, t, r.get(t) ?? "", i, void 0, e);
			q();
			return;
		}
		for (let [e, t] of n) A.style.setProperty(e, t);
		let i = n.filter(([e, t]) => r.get(e) !== t).map(([e, t]) => kt(A, e, r.get(e) ?? "", t));
		i.length && (I((e) => [...e, ...Ni(i)]), L([])), q();
	}, [
		A,
		R,
		Gn,
		q
	]), Zn = e((e) => {
		let t = crypto.randomUUID(), n = [];
		for (let { element: r, styles: i } of e) {
			let e = getComputedStyle(r);
			for (let [a, o] of Object.entries(i)) {
				let i = r.style.getPropertyValue(a) || e.getPropertyValue(a);
				i !== o && (R === "all" ? (r.style.setProperty(a, o), n.push({
					...kt(r, a, i, o),
					groupId: t
				})) : Gn(r, a, i, o, void 0, t));
			}
		}
		n.length && I((e) => [...e, ...n]), (n.length || R !== "all") && L([]), q();
	}, [
		R,
		Gn,
		q
	]), X = e((e, t, n, r) => {
		let i = e.getAttribute(t) ?? "";
		i !== n && (n ? e.setAttribute(t, n) : e.removeAttribute(t), I((a) => [...a, Ot(e, t, i, n, r)]), L([]), q());
	}, [q]), $n = e((e, t, n) => {
		A && X(A, e, t, n);
	}, [A, X]), Z = e((e) => {
		qt(e), window.setTimeout(() => qt((t) => t === e ? "" : t), 2400);
	}, []), Q = e(async (e, t) => {
		try {
			let n = await ji(e);
			J(t.element), t.kind === "image" ? (X(t.element, "src", n, `Replace image with "${e.name || "pasted image"}"`), Z("Image replaced")) : (qn(t.element, "background-image", `url("${n}")`, !0, `Use "${e.name || "pasted image"}" as background`), Z(R === "all" ? "Background image set" : `Background set for ${R}`));
		} catch (e) {
			Z(e instanceof Error ? e.message : "That image could not be used.");
		}
	}, [
		J,
		X,
		qn,
		Z,
		R
	]);
	t(() => {
		if (!c || U) return;
		let e = (e) => {
			if (xt(e)) return null;
			let t = St(e);
			return t ? {
				element: t,
				kind: t.matches("img") ? "image" : "background"
			} : null;
		}, t = (t) => {
			if (!t.dataTransfer?.types.includes("Files")) return;
			let n = e(t.target);
			n && (t.preventDefault(), t.dataTransfer.dropEffect = "copy", Gt((e) => e?.element === n.element && e.kind === n.kind ? e : n));
		}, n = () => Gt(null), r = (e) => {
			e.relatedTarget || n();
		}, i = (t) => {
			let r = e(t.target), i = [...t.dataTransfer?.files ?? []].find((e) => e.type.startsWith("image/"));
			n(), !(!r || !i) && (t.preventDefault(), t.stopPropagation(), Q(i, r));
		}, a = (e) => {
			if (!A || xt(e.target) || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLElement && e.target.isContentEditable) return;
			let t = [...e.clipboardData?.files ?? []].find((e) => e.type.startsWith("image/"));
			t && (e.preventDefault(), Q(t, {
				element: A,
				kind: A.matches("img") ? "image" : "background"
			}));
		};
		return document.addEventListener("dragover", t, !0), document.addEventListener("drop", i, !0), document.addEventListener("dragleave", r, !0), window.addEventListener("dragend", n, !0), window.addEventListener("paste", a, !0), () => {
			document.removeEventListener("dragover", t, !0), document.removeEventListener("drop", i, !0), document.removeEventListener("dragleave", r, !0), window.removeEventListener("dragend", n, !0), window.removeEventListener("paste", a, !0);
		};
	}, [
		c,
		U,
		A,
		Q
	]);
	let cr = e((e, t) => {
		A?.style.transform.match(/^translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)$/) && A.style.removeProperty("transform");
		let n = Math.round(e), r = Math.round(t);
		Y("translate", n === 0 && r === 0 ? "none" : `${n}px ${r}px`);
	}, [A, Y]), $ = e((e, t) => {
		if (!A?.parentElement) return;
		let n = A.getBoundingClientRect(), r = A.parentElement.getBoundingClientRect(), i = getComputedStyle(A.parentElement), a = Number.parseFloat(i.paddingLeft) || 0, o = Number.parseFloat(i.paddingRight) || 0, s = Number.parseFloat(i.paddingTop) || 0, c = Number.parseFloat(i.paddingBottom) || 0, l = Et(A);
		if (e === "horizontal") {
			let e = r.left + a, i = r.right - o, s = t === "start" ? e : t === "center" ? e + (i - e - n.width) / 2 : i - n.width;
			cr(l.x + s - n.left, l.y);
			return;
		}
		let u = r.top + s, d = r.bottom - c, f = t === "start" ? u : t === "center" ? u + (d - u - n.height) / 2 : d - n.height;
		cr(l.x, l.y + f - n.top);
	}, [A, cr]), lr = M.filter((e) => document.contains(e)), ur = lr.length > 1 && lr.every((e) => e.dataset.vtGroup && e.dataset.vtGroup === lr[0].dataset.vtGroup) ? lr[0].dataset.vtGroup : "", dr = e((e, t) => {
		let n = M.filter((e) => document.contains(e));
		if (n.length < 2) return;
		let r = n.map((e) => e.getBoundingClientRect()), i = Math.min(...r.map((t) => e === "horizontal" ? t.left : t.top)), a = Math.max(...r.map((t) => e === "horizontal" ? t.right : t.bottom)), o = (i + a) / 2;
		Zn(n.map((n, s) => {
			let c = r[s], l = Et(n), u = e === "horizontal" ? c.left : c.top, d = e === "horizontal" ? c.right : c.bottom, f = (u + d) / 2, p = t === "start" ? i - u : t === "center" ? o - f : a - d;
			return {
				element: n,
				styles: { translate: Ai(e === "horizontal" ? l.x + p : l.x, e === "vertical" ? l.y + p : l.y) }
			};
		}));
	}, [M, Zn]), fr = e((e) => {
		let t = M.filter((e) => document.contains(e));
		if (t.length < 3) return;
		let n = t.map((e) => ({
			element: e,
			rect: e.getBoundingClientRect()
		})).sort((t, n) => e === "horizontal" ? t.rect.left - n.rect.left : t.rect.top - n.rect.top), r = n[0].rect, i = n[n.length - 1].rect, a = e === "horizontal" ? r.left : r.top, o = e === "horizontal" ? i.right : i.bottom, s = n.reduce((t, n) => t + (e === "horizontal" ? n.rect.width : n.rect.height), 0), c = (o - a - s) / (n.length - 1), l = a, u = n.map(({ element: t, rect: n }) => {
			let r = Et(t), i = e === "horizontal" ? n.left : n.top, a = l - i;
			return l += (e === "horizontal" ? n.width : n.height) + c, {
				element: t,
				styles: { translate: Ai(e === "horizontal" ? r.x + a : r.x, e === "vertical" ? r.y + a : r.y) }
			};
		});
		Zn(u);
	}, [M, Zn]), pr = e(() => {
		let e = M.filter((e) => document.contains(e));
		if (e.length < 2) return;
		let t = crypto.randomUUID(), n = crypto.randomUUID(), r = e.map((e) => {
			let r = e.getAttribute("data-vt-group") ?? "";
			return e.dataset.vtGroup = t, {
				...Ot(e, "data-vt-group", r, t, `Group as ${t.slice(0, 8)}`),
				groupId: n
			};
		});
		I((e) => [...e, ...r]), L([]), q();
	}, [M, q]), mr = e(() => {
		let e = M.filter((e) => document.contains(e) && e.dataset.vtGroup);
		if (!e.length) return;
		let t = crypto.randomUUID(), n = e.map((e) => {
			let n = e.dataset.vtGroup ?? "";
			return e.removeAttribute("data-vt-group"), {
				...Ot(e, "data-vt-group", n, "", "Ungroup"),
				groupId: t
			};
		});
		I((e) => [...e, ...n]), L([]), q();
	}, [M, q]), hr = e((e, t) => {
		if (!A) return;
		let n = M.filter((e) => document.contains(e));
		if (n.length > 1) {
			Zn(n.map((n) => {
				let r = Et(n);
				return {
					element: n,
					styles: { translate: Ai(r.x + e, r.y + t) }
				};
			})), zn({
				kind: "move",
				x: e,
				y: t,
				axis: null,
				snappingPaused: !1
			});
			return;
		}
		let r = Et(A);
		cr(r.x + e, r.y + t), zn({
			kind: "move",
			x: r.x + e,
			y: r.y + t,
			axis: null,
			snappingPaused: !1
		});
	}, [
		A,
		M,
		Zn,
		cr,
		zn
	]), Sr = e((e) => {
		if (!A) return;
		let t = A.getBoundingClientRect(), n = Math.max(24, Math.round(t.width * e)), r = Math.max(20, Math.round(t.height * e));
		Xn({
			width: `${n}px`,
			height: `${r}px`
		}), zn({
			kind: "resize",
			width: n,
			height: r,
			deltaWidth: Math.round(n - t.width),
			deltaHeight: Math.round(r - t.height),
			ratioLocked: !0
		});
	}, [
		A,
		Xn,
		zn
	]), Or = e((e) => {
		if (!A || !Nt(A)) return;
		let t = Number.parseFloat(getComputedStyle(A).fontSize) || 16;
		Y("font-size", `${Math.max(8, Math.round(t + e))}px`);
	}, [A, Y]), Mr = e((e, t) => {
		if (!A) return;
		let n = getComputedStyle(A), r = Number.parseFloat(n.getPropertyValue(e)) || 0;
		if (R !== "all") {
			let t = H(A), n = [...F].reverse().find((n) => n.kind === "responsive-style" && n.device === R && n.selector === t && n.property === e);
			if (n) {
				let e = Number.parseFloat(n.runtimeValue ?? n.value);
				Number.isFinite(e) && (r = e);
			}
		}
		let i = e.startsWith("padding-") || e === "gap" ? 0 : -1e3;
		Y(e, `${Math.max(i, Math.round(r + t))}px`);
	}, [
		A,
		R,
		F,
		Y
	]), Ir = e((e, t) => {
		if (!A) return;
		let n = A.getBoundingClientRect(), r = Number.parseFloat(t);
		if (!z) {
			if (Y(e, t), Number.isFinite(r)) {
				let t = Math.round(e === "width" ? r : n.width), i = Math.round(e === "height" ? r : n.height);
				zn({
					kind: "resize",
					width: t,
					height: i,
					deltaWidth: Math.round(t - n.width),
					deltaHeight: Math.round(i - n.height),
					ratioLocked: !1
				});
			}
			return;
		}
		if (!Number.isFinite(r)) return;
		let i = n.width / Math.max(1, n.height), a = e === "width" ? Math.round(r) : Math.max(24, Math.round(r * i)), o = e === "height" ? Math.round(r) : Math.max(20, Math.round(r / i));
		Xn({
			width: `${a}px`,
			height: `${o}px`
		}), zn({
			kind: "resize",
			width: a,
			height: o,
			deltaWidth: Math.round(a - n.width),
			deltaHeight: Math.round(o - n.height),
			ratioLocked: !0
		});
	}, [
		A,
		z,
		Y,
		Xn,
		zn
	]), Lr = e(() => {
		Xn({
			width: "100%",
			height: "auto",
			"max-width": "none"
		});
	}, [Xn]), zr = e((e) => {
		if (!A || !Nt(A)) return;
		let t = A.innerText;
		t !== e && (A.dataset.vtOverride = "content", A.innerText = e, I((n) => Fi(n, kt(A, "text-content", t, e))), L([]), q());
	}, [A, q]), Br = e((e, t, n) => {
		A && (A.dataset.vtOverride = "content", $n(e, t, n));
	}, [A, $n]), Vr = e((e) => {
		if (!A) return;
		if (e === "match-spacing") {
			let e = A.previousElementSibling instanceof HTMLElement ? A.previousElementSibling : A.nextElementSibling instanceof HTMLElement ? A.nextElementSibling : null;
			if (!e) return Z("Select an element with a nearby sibling");
			let t = getComputedStyle(e);
			Xn({
				"margin-top": t.marginTop,
				"margin-right": t.marginRight,
				"margin-bottom": t.marginBottom,
				"margin-left": t.marginLeft,
				"padding-top": t.paddingTop,
				"padding-right": t.paddingRight,
				"padding-bottom": t.paddingBottom,
				"padding-left": t.paddingLeft
			}), Z("Matched sibling spacing");
			return;
		}
		if (e === "distribute") {
			let e = A.children.length > 1 ? A : A.parentElement;
			if (!e || e === document.body) return;
			qn(e, "display", "flex"), qn(e, "justify-content", "space-between"), qn(e, "align-items", "center"), Z("Distributed children evenly");
			return;
		}
		if (e === "responsive") {
			Xn({
				"max-width": "100%",
				"box-sizing": "border-box",
				...A.matches("img, video") ? {
					width: "100%",
					height: "auto"
				} : {}
			}), Z("Responsive sizing applied");
			return;
		}
		if (e === "typography") {
			let e = getComputedStyle(document.body);
			Xn({
				"font-family": e.fontFamily,
				"line-height": e.lineHeight === "normal" ? "1.5" : e.lineHeight
			}), Z("Project typography applied");
			return;
		}
		let t = getComputedStyle(A), n = (t.backgroundColor === "rgba(0, 0, 0, 0)" ? getComputedStyle(A.parentElement ?? document.body).backgroundColor : t.backgroundColor).match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [
			255,
			255,
			255
		], r = (n[0] * .299 + n[1] * .587 + n[2] * .114) / 255;
		Y("color", r > .55 ? "#111111" : "#ffffff"), Z("Contrast corrected");
	}, [
		A,
		Xn,
		qn,
		Y,
		Z
	]), Hr = e((e) => {
		let t = An.current?.contentEditable;
		t == null ? e.removeAttribute("contenteditable") : e.setAttribute("contenteditable", t), e.classList.remove("vt-editing-text-target"), e.blur();
	}, []), Wr = e((e) => {
		Nt(e) && (An.current = {
			text: e.innerText,
			contentEditable: e.getAttribute("contenteditable"),
			style: e.getAttribute("style"),
			changeCount: F.length
		}, e.setAttribute("contenteditable", "true"), e.classList.add("vt-editing-text-target"), G(null), It(!0), window.requestAnimationFrame(() => {
			e.focus();
			let t = document.createRange();
			t.selectNodeContents(e), t.collapse(!1);
			let n = window.getSelection();
			n?.removeAllRanges(), n?.addRange(t);
		}));
	}, [F.length]), Gr = e(() => {
		A && Wr(A);
	}, [A, Wr]);
	t(() => {
		if (!c || U) return;
		let e = (e) => {
			if (xt(e.target)) return;
			let t = St(e.target);
			if (!t) return;
			let n = t.closest("section, article, header, footer, nav");
			if (e.preventDefault(), e.stopPropagation(), v === "easy" && !Nt(t)) {
				n && (Oe(n), J(n));
				return;
			}
			Nt(t) && (J(t), Wr(t));
		};
		return document.addEventListener("dblclick", e, !0), () => document.removeEventListener("dblclick", e, !0);
	}, [
		c,
		U,
		v,
		J,
		Wr
	]);
	let qr = e(() => {
		if (!A || !An.current) return;
		let e = An.current.text, t = A.innerText;
		Hr(A), t !== e && (I((n) => [...n, kt(A, "text-content", e, t)]), L([])), An.current = null, It(!1), q();
	}, [
		A,
		Hr,
		q
	]), Yr = e(() => {
		if (!A || !An.current) return;
		A.innerText = An.current.text;
		let e = An.current.style, t = An.current.changeCount;
		e === null ? A.removeAttribute("style") : A.setAttribute("style", e), I((e) => e.slice(0, t)), L([]), Hr(A), An.current = null, It(!1), q();
	}, [
		A,
		Hr,
		q
	]);
	t(() => {
		let e = (e) => {
			if (e.key === "Escape" && U) {
				e.preventDefault(), Yr();
				return;
			}
			e.key === "Escape" && (G(null), j(null), Ke([])), (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "v" && l((e) => !e);
			let t = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLElement && e.target.isContentEditable;
			if (c && e.key === "Tab" && !U && !t && !xt(e.target)) {
				e.preventDefault(), e.shiftKey ? ee((e) => !e) : Ln();
				return;
			}
			if (U || !c || !A || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
			let n = e.shiftKey ? 10 : 1, r = {
				ArrowUp: [0, -n],
				ArrowDown: [0, n],
				ArrowLeft: [-n, 0],
				ArrowRight: [n, 0]
			}[e.key];
			r && (e.preventDefault(), hr(...r));
		};
		return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
	}, [
		c,
		A,
		hr,
		U,
		Yr,
		Ln
	]);
	let Xr = e((e) => {
		let t = Dn.current;
		if (!t || e.buttons === 0) return;
		let n = Math.round(e.clientX - t.startX), r = Math.round(e.clientY - t.startY);
		e.shiftKey && (Math.abs(n) >= Math.abs(r) ? r = 0 : n = 0), rn && !e.altKey && (n = Math.round(n / on) * on, r = Math.round(r / on) * on), t.elements.forEach((e, i) => {
			let a = t.translations[i];
			e.style.translate = Ai(a.x + n, a.y + r);
		}), Ut({
			kind: "move",
			x: n,
			y: r,
			axis: e.shiftKey ? Math.abs(n) >= Math.abs(r) ? "x" : "y" : null,
			snappingPaused: e.altKey
		}), q();
	}, [
		rn,
		on,
		q
	]), Zr = e(() => {
		let e = Dn.current;
		if (!e) return;
		let t = crypto.randomUUID(), n = [];
		e.elements.forEach((r, i) => {
			let a = e.translations[i], o = Et(r), s = Ai(a.x, a.y), c = Ai(o.x, o.y);
			c !== s && n.push({
				...kt(r, "translate", s, c),
				groupId: t
			});
		}), n.length && (I((e) => [...e, ...n]), L([])), Dn.current = null, Vt({
			x: null,
			y: null
		}), window.removeEventListener("pointermove", Xr), window.removeEventListener("pointerup", Zr), window.removeEventListener("pointercancel", Zr), q();
	}, [Xr, q]), $r = e((e) => {
		let t = M.filter((e) => document.contains(e) && e.getAttribute("data-vt-locked") !== "true");
		t.length < 2 || e.button !== 0 || (e.preventDefault(), e.stopPropagation(), Dn.current = {
			startX: e.clientX,
			startY: e.clientY,
			elements: t,
			translations: t.map((e) => ({
				...Et(e),
				inline: e.style.translate
			}))
		}, window.addEventListener("pointermove", Xr), window.addEventListener("pointerup", Zr), window.addEventListener("pointercancel", Zr));
	}, [
		M,
		Xr,
		Zr
	]), ai = e((e) => {
		if (!Sn.current || !A || e.buttons === 0) return;
		let t = Sn.current, n = Math.round(e.clientX - t.startX), r = Math.round(e.clientY - t.startY);
		if (t.kind === "move") {
			let i = e.shiftKey ? Math.abs(n) >= Math.abs(r) ? "x" : "y" : null;
			i === "x" && (r = 0), i === "y" && (n = 0);
			let a = e.altKey, o = a || i === "y" ? null : ki([
				t.startLeft + n,
				t.startLeft + n + t.startWidth / 2,
				t.startLeft + n + t.startWidth
			], t.guidesX), s = a || i === "x" ? null : ki([
				t.startTop + r,
				t.startTop + r + t.startHeight / 2,
				t.startTop + r + t.startHeight
			], t.guidesY), c = rn && !a && !o && i !== "y" ? Math.round((t.startLeft + n) / on) * on - t.startLeft : n, l = rn && !a && !s && i !== "x" ? Math.round((t.startTop + r) / on) * on - t.startTop : r, u = c + (o?.adjustment ?? 0), d = l + (s?.adjustment ?? 0);
			A.style.setProperty("translate", Ai(t.startTranslateX + u, t.startTranslateY + d)), Vt({
				x: o?.guide ?? (rn && !a ? t.startLeft + u : null),
				y: s?.guide ?? (rn && !a ? t.startTop + d : null)
			}), Ut({
				kind: "move",
				x: t.startTranslateX + u,
				y: t.startTranslateY + d,
				axis: i,
				snappingPaused: a
			});
		} else {
			let i = t.handle?.includes("e") ? n : t.handle?.includes("w") ? -n : 0, a = t.handle?.includes("s") ? r : t.handle?.includes("n") ? -r : 0, o = Nt(A), s = t.handle === "e" || t.handle === "w";
			if (o && C === "scale" && (i || a)) {
				let e = i ? (t.startWidth + i) / Math.max(1, t.startWidth) : 1, n = a ? (t.startHeight + a) / Math.max(1, t.startHeight) : 1, r = i && a ? Math.abs(e - 1) >= Math.abs(n - 1) ? e : n : i ? e : n, o = Math.max(8 / t.startFontSize, Math.min(240 / t.startFontSize, r)), s = t.startFontSize * o, c = Math.max(48, Math.round(t.startWidth * o)), l = Math.max(20, Math.round(t.startHeight * o));
				if (A.style.setProperty("width", `${c}px`), A.style.setProperty("height", `${l}px`), A.style.setProperty("max-width", "none"), A.style.setProperty("box-sizing", "border-box"), A.style.setProperty("font-size", `${s.toFixed(2)}px`), A.scrollWidth > A.clientWidth + 1 || A.scrollHeight > A.clientHeight + 1) {
					let e = 8, t = s;
					for (let n = 0; n < 9; n += 1) {
						let n = (e + t) / 2;
						A.style.setProperty("font-size", `${n.toFixed(2)}px`), A.scrollWidth <= A.clientWidth + 1 && A.scrollHeight <= A.clientHeight + 1 ? e = n : t = n;
					}
					s = e, A.style.setProperty("font-size", `${s.toFixed(2)}px`);
				}
				Ut({
					kind: "resize",
					width: c,
					height: l,
					deltaWidth: Math.round(c - t.startWidth),
					deltaHeight: Math.round(l - t.startHeight),
					ratioLocked: !0,
					fontSize: s
				}), q();
				return;
			}
			if (o && s && C === "reflow") {
				let e = Math.max(t.minTextWidth, Math.round(t.startWidth + i));
				A.style.setProperty("width", `${e}px`), A.style.setProperty("height", "auto"), A.style.setProperty("max-width", "none"), A.style.setProperty("box-sizing", "border-box");
				let n = Math.round(A.getBoundingClientRect().height);
				Ut({
					kind: "resize",
					width: e,
					height: n,
					deltaWidth: Math.round(e - t.startWidth),
					deltaHeight: Math.round(n - t.startHeight),
					ratioLocked: !1
				}), q();
				return;
			}
			let c = z || e.shiftKey, l, u;
			if (c) {
				let e = i ? (t.startWidth + i) / t.startWidth : 1, n = a ? (t.startHeight + a) / t.startHeight : 1, r = i && a ? Math.abs(e - 1) >= Math.abs(n - 1) ? e : n : i ? e : n, o = Math.max(24 / t.startWidth, 20 / t.startHeight), s = Math.max(o, r);
				l = Math.round(t.startWidth * s), u = Math.round(t.startHeight * s);
			} else l = Math.max(24, Math.round(t.startWidth + i)), u = Math.max(20, Math.round(t.startHeight + a));
			A.style.setProperty("width", `${l}px`), A.style.setProperty("height", `${u}px`), A.style.setProperty("box-sizing", "border-box"), o && C === "reflow" && (l = Math.max(t.minTextWidth, l), A.style.setProperty("width", `${l}px`), A.scrollHeight > A.clientHeight + 1 && (u = Math.ceil(A.scrollHeight), A.style.setProperty("height", `${u}px`))), Ut({
				kind: "resize",
				width: l,
				height: u,
				deltaWidth: Math.round(l - t.startWidth),
				deltaHeight: Math.round(u - t.startHeight),
				ratioLocked: c
			});
		}
		q();
	}, [
		A,
		z,
		rn,
		on,
		C,
		q
	]), si = e(() => {
		let e = Sn.current;
		if (!(!e || !A)) {
			if (e.kind === "move") {
				let t = Et(A);
				if (Math.round(t.x) !== Math.round(e.startTranslateX) || Math.round(t.y) !== Math.round(e.startTranslateY)) {
					let n = Ai(e.startTranslateX, e.startTranslateY), r = Ai(t.x, t.y);
					A.style.translate = r, R === "all" ? I((e) => [...e, kt(A, "translate", n, r)]) : (A.style.translate = e.startInlineTranslate, Gn(A, "translate", n, r));
				} else A.style.translate = e.startInlineTranslate;
			} else {
				let t = A.style.width, n = A.style.height, r = A.style.fontSize;
				if (R === "all") {
					let i = [];
					r !== e.startInlineFontSize && i.push(kt(A, "font-size", `${Math.round(e.startFontSize)}px`, r)), t !== e.startInlineWidth && i.push(kt(A, "width", `${Math.round(e.startWidth)}px`, t)), n !== e.startInlineHeight && i.push(kt(A, "height", `${Math.round(e.startHeight)}px`, n)), i.length && I((e) => [...e, ...Ni(i)]);
				} else {
					let i = [
						r !== e.startInlineFontSize,
						t !== e.startInlineWidth,
						n !== e.startInlineHeight
					].filter(Boolean).length > 1 ? crypto.randomUUID() : void 0;
					A.style.fontSize = e.startInlineFontSize, A.style.width = e.startInlineWidth, A.style.height = e.startInlineHeight, r !== e.startInlineFontSize && Gn(A, "font-size", `${Math.round(e.startFontSize)}px`, r, void 0, i), t !== e.startInlineWidth && Gn(A, "width", `${Math.round(e.startWidth)}px`, t, void 0, i), n !== e.startInlineHeight && Gn(A, "height", `${Math.round(e.startHeight)}px`, n, void 0, i);
				}
			}
			L([]), Vt({
				x: null,
				y: null
			}), Ut(null), Sn.current = null, Cn.current && (En.current = !0, window.setTimeout(() => {
				En.current = !1;
			}, 0)), Cn.current = !1, window.removeEventListener("pointermove", ai), window.removeEventListener("pointerup", si), window.removeEventListener("pointercancel", si), q();
		}
	}, [
		A,
		R,
		Gn,
		ai,
		q
	]), fi = e((e, t, n) => {
		if (!A || A.getAttribute("data-vt-locked") === "true" || t.button !== 0) return;
		t.preventDefault(), t.stopPropagation(), On.current !== null && (window.clearTimeout(On.current), On.current = null);
		let r = A.getBoundingClientRect(), i = A.parentElement, a = (i ? [i, ...[...i.children].filter((e) => e !== A && e instanceof HTMLElement && !xt(e))] : []).map((e) => e.getBoundingClientRect()), o = document.querySelector("[data-vt-workspace-canvas=\"true\"]"), s = o?.getBoundingClientRect(), c = o && s ? Pe.filter((e) => e.axis === "x").map((e) => s.left + e.position - o.scrollLeft) : [], l = o && s ? Pe.filter((e) => e.axis === "y").map((e) => s.top + e.position - o.scrollTop) : [], u = en ? [
			0,
			window.innerWidth / 2,
			window.innerWidth,
			...c,
			...a.flatMap((e) => [
				e.left,
				e.left + e.width / 2,
				e.right
			])
		] : [], d = en ? [
			0,
			window.innerHeight / 2,
			window.innerHeight,
			...l,
			...a.flatMap((e) => [
				e.top,
				e.top + e.height / 2,
				e.bottom
			])
		] : [], f = Et(A);
		Sn.current = {
			kind: e,
			handle: n,
			startX: t.clientX,
			startY: t.clientY,
			startWidth: r.width,
			startHeight: r.height,
			startTranslateX: f.x,
			startTranslateY: f.y,
			startInlineTranslate: A.style.translate,
			startInlineWidth: A.style.width,
			startInlineHeight: A.style.height,
			startInlineFontSize: A.style.fontSize,
			startFontSize: Number.parseFloat(getComputedStyle(A).fontSize) || 16,
			minTextWidth: Nt(A) ? Mi(A) : 48,
			startLeft: r.left,
			startTop: r.top,
			guidesX: u,
			guidesY: d
		}, Ut(e === "move" ? {
			kind: "move",
			x: f.x,
			y: f.y,
			axis: null,
			snappingPaused: !1
		} : {
			kind: "resize",
			width: Math.round(r.width),
			height: Math.round(r.height),
			deltaWidth: 0,
			deltaHeight: 0,
			ratioLocked: z
		}), window.addEventListener("pointermove", ai), window.addEventListener("pointerup", si), window.addEventListener("pointercancel", si);
	}, [
		A,
		en,
		Pe,
		z,
		ai,
		si
	]);
	t(() => {
		if (!c || m || U || !A || M.length > 1 || A.getAttribute("data-vt-locked") === "true") return;
		let e = (e) => {
			if (e.button !== 0 || xt(e.target) || !(e.target instanceof Node) || !A.contains(e.target)) return;
			let t = e.clientX, n = e.clientY, r = e.pointerId, i = !1, a = (e) => {
				e.pointerId === r && (!i && Math.hypot(e.clientX - t, e.clientY - n) >= 5 && (i = !0, Cn.current = !0, fi("move", {
					button: 0,
					clientX: t,
					clientY: n,
					preventDefault: () => {},
					stopPropagation: () => {}
				})), i && e.preventDefault());
			}, o = (e) => {
				e.pointerId === r && (window.removeEventListener("pointermove", a, !0), window.removeEventListener("pointerup", o, !0), window.removeEventListener("pointercancel", o, !0));
			};
			window.addEventListener("pointermove", a, {
				capture: !0,
				passive: !1
			}), window.addEventListener("pointerup", o, !0), window.addEventListener("pointercancel", o, !0);
		};
		return document.addEventListener("pointerdown", e, !0), () => document.removeEventListener("pointerdown", e, !0);
	}, [
		c,
		m,
		U,
		A,
		M.length,
		fi
	]);
	let Hi = e(() => {
		let e = Pi(F);
		if (!e.length) return;
		let t = null;
		for (let n of [...e].reverse()) t = Sa(n, "undo") ?? t;
		I((t) => t.slice(0, -e.length)), L((t) => [...t, ...e]), t && t !== document.body ? J(t) : A && !document.contains(A) && (j(null), Ye(null)), q();
	}, [
		F,
		A,
		J,
		q
	]), Qi = e(() => {
		let e = Pi(Xe);
		if (!e.length) return;
		let t = null;
		for (let n of e) t = Sa(n, "redo") ?? t;
		L((t) => t.slice(0, -e.length)), I((t) => [...t, ...e]), t && t !== document.body ? J(t) : A && !document.contains(A) && (j(null), Ye(null)), q();
	}, [
		Xe,
		A,
		J,
		q
	]), $i = e(() => {
		if (!A) return;
		let e = H(A), t = F.filter((t) => t.selector === e), n = A;
		for (let e of [...t].reverse()) n = Sa(e, "undo") ?? n;
		t.some((e) => e.stableId) && A.removeAttribute("data-vt-id"), I((t) => t.filter((t) => t.selector !== e)), L([]), n && n !== document.body ? J(n) : document.contains(A) || (j(null), Ye(null)), q();
	}, [
		A,
		F,
		J,
		q
	]), ea = e(() => {
		if (!A) return;
		if (R === "all") {
			$i();
			return;
		}
		let e = H(A);
		I((t) => t.filter((t) => !(t.kind === "responsive-style" && t.device === R && t.selector === e))), L([]), q();
	}, [
		A,
		R,
		$i,
		q
	]), ta = e(() => {
		for (let e of [...F].reverse()) Sa(e, "undo");
		document.querySelectorAll("[data-vt-id]").forEach((e) => e.removeAttribute("data-vt-id")), I([]), L([]), j(null), Ke([]), Ye(null), q();
	}, [F, q]), na = e((e) => {
		for (let e of [...F].reverse()) Sa(e, "undo");
		let t = F.filter((t) => t.id !== e.id);
		gn(document, t), I(t), L([]), j(null), Ye(null), nt((e) => e + 1);
	}, [F]), ra = e(() => {
		if (!A) return;
		let e = getComputedStyle(A);
		zt(Object.fromEntries(ui.map((t) => [t, e.getPropertyValue(t)]))), G(null);
	}, [A]), ia = e(() => {
		!A || !Rt || (Xn(Rt), G(null));
	}, [
		A,
		Rt,
		Xn
	]), aa = e((e) => {
		if (!A) return;
		let t = Number.parseInt(getComputedStyle(A).zIndex);
		Y("position", getComputedStyle(A).position === "static" ? "relative" : getComputedStyle(A).position), Y("z-index", String((Number.isFinite(t) ? t : 0) + e)), G(null);
	}, [A, Y]), oa = e(() => {
		Y("visibility", "hidden"), G(null);
	}, [Y]), sa = e(() => {
		if (!A) return;
		let e = A.dataset.vtLabel || Ct(A), t = window.prompt("Layer name", e)?.trim();
		t && t !== e && X(A, "data-vt-label", t, `Rename layer to "${t}"`), G(null);
	}, [A, X]), ca = e(() => {
		A && (X(A, "data-vt-locked", A.dataset.vtLocked === "true" ? "" : "true"), G(null));
	}, [A, X]), la = e((e, t) => {
		let n = tr(A), r = !!A?.matches("main, section, article, header, footer, nav, aside, div, form, ul, ol"), i = v === "easy" && A && t !== "inside" && A.parentElement ? {
			parent: A.parentElement,
			index: sr(A) + +(t === "after")
		} : v === "easy" && A && t === "inside" && r ? {
			parent: A,
			index: A.children.length
		} : n, a = nr(e);
		rr(i.parent, a, i.index), I((e) => [...e, jt(a, "insert", i.parent, i.index)]), L([]), J(a), q();
	}, [
		A,
		v,
		J,
		q
	]), ua = e((e) => la(e, k), [la, k]), da = e(() => {
		if (!A) return;
		let e = window.prompt("Component name", wt(A))?.trim();
		if (!e) return;
		let t = crypto.randomUUID();
		X(A, "data-vt-component", t, `Create component "${e}"`), X(A, "data-vt-component-instance", crypto.randomUUID(), `Mark "${e}" instance`);
		let n = {
			id: t,
			name: e,
			html: A.outerHTML,
			createdAt: Date.now()
		};
		je((e) => [n, ...e]), Z(`Created ${e}`);
	}, [
		A,
		X,
		Z
	]), fa = e((e) => {
		let t = tr(A), n = ar(t.parent, e.html, t.index);
		n && (n.dataset.vtComponent = e.id, n.dataset.vtComponentInstance = crypto.randomUUID(), I((e) => [...e, jt(n, "insert", t.parent, t.index)]), L([]), J(n), q(), Z(`Inserted ${e.name}`));
	}, [
		A,
		J,
		q,
		Z
	]), pa = e((e) => {
		if (!A || A.dataset.vtComponent !== e.id) return Z(`Select a ${e.name} instance first`);
		let t = {
			...e,
			html: A.outerHTML
		};
		je((n) => n.map((n) => n.id === e.id ? t : n));
		let n = A.cloneNode(!0), r = [...document.querySelectorAll(`[data-vt-component="${CSS.escape(e.id)}"]`)].filter((e) => e !== A);
		r.forEach((e) => {
			let t = [...e.querySelectorAll("[data-vt-override=\"content\"]")], r = t.map((e, n) => ({
				label: e.dataset.vtLabel ?? "",
				tag: e.tagName,
				tagIndex: t.slice(0, n).filter((t) => t.tagName === e.tagName).length,
				html: e.innerHTML,
				href: e.getAttribute("href"),
				src: e.getAttribute("src"),
				alt: e.getAttribute("alt"),
				target: e.getAttribute("target")
			})), i = n.cloneNode(!0);
			i.dataset.vtComponentInstance = e.dataset.vtComponentInstance || crypto.randomUUID(), r.forEach((e) => {
				let t = e.label ? i.querySelector(`[data-vt-label="${CSS.escape(e.label)}"]`) : null, n = [...i.querySelectorAll(e.tag.toLowerCase())], r = t ?? n[e.tagIndex];
				if (!(!r || r.tagName !== e.tag)) {
					r.dataset.vtOverride = "content", r.innerHTML = e.html;
					for (let [t, n] of [
						["href", e.href],
						["src", e.src],
						["alt", e.alt],
						["target", e.target]
					]) n === null ? r.removeAttribute(t) : r.setAttribute(t, n);
				}
			}), e.replaceWith(i);
		}), q(), Z(`Updated ${r.length + 1} ${e.name} instances`);
	}, [
		A,
		q,
		Z
	]), ma = e((e) => {
		je((t) => t.filter((t) => t.id !== e)), document.querySelectorAll(`[data-vt-component="${CSS.escape(e)}"]`).forEach((e) => {
			delete e.dataset.vtComponent, delete e.dataset.vtComponentInstance;
		});
	}, []), ha = e(() => {
		if (!A?.parentElement || A.parentElement === document.body || A.tagName === "MAIN") return;
		let e = A.parentElement, t = or(A), n = sr(A) + 1;
		rr(e, t, n), I((r) => [...r, jt(t, "insert", e, n)]), L([]), J(t), q();
	}, [
		A,
		J,
		q
	]), ga = e(() => {
		!A || A === document.body || A.tagName === "MAIN" || (Mn.current = A.cloneNode(!0), In(!0), G(null), Z("Element copied"));
	}, [A, Z]), _a = e(() => {
		if (!Mn.current) return;
		let e = tr(A), t = or(Mn.current);
		rr(e.parent, t, e.index), I((n) => [...n, jt(t, "insert", e.parent, e.index)]), L([]), G(null), J(t), Z("Element pasted"), q();
	}, [
		A,
		J,
		Z,
		q
	]), va = e(() => {
		if (!A?.parentElement || A.parentElement === document.body || A.tagName === "MAIN") return;
		let e = A, t = A.parentElement, n = jt(e, "remove", t, sr(e));
		e.remove(), I((e) => [...e, n]), L([]), G(null), t === document.body ? (j(null), Ke([]), Ye(null)) : J(t), q();
	}, [
		A,
		J,
		q
	]), ya = e((e) => {
		if (!A?.parentElement || A.parentElement === document.body || A.tagName === "MAIN") return;
		let t = A.parentElement, n = sr(A), r = Ii(A), i = Math.max(0, Math.min(t.children.length - 1, n + e));
		if (i === n) return;
		let a = ir(t, A, i);
		I((e) => [...e, jt(A, "reorder", t, a, n, t, r)]), L([]), G(null), q();
	}, [A, q]), ba = e((e) => {
		if (!A?.parentElement || A.parentElement === document.body || e === document.body || e === A || A.contains(e) || A.tagName === "MAIN") return;
		let t = A.parentElement;
		if (t === e) return;
		let n = sr(A), r = Ii(A), i = ir(e, A, e.children.length);
		I((a) => [...a, jt(A, "reorder", e, i, n, t, r)]), L([]), J(A), q();
	}, [
		A,
		J,
		q
	]), xa = e((e, t, n) => {
		let r = e.parentElement, i = n === "inside" ? t : t.parentElement;
		if (!r || !i || r === document.body || i === document.body || e === t || e.contains(i) || e.tagName === "MAIN") return;
		let a = sr(e), o = Ii(e), s = n === "inside" ? i.children.length : sr(t) + +(n === "after");
		if (r === i && a < s && --s, r === i && s === a) return;
		let c = ir(i, e, s);
		I((t) => [...t, jt(e, "reorder", i, c, a, r, o)]), L([]), J(e), q();
	}, [J, q]);
	function Sa(e, t) {
		if (e.kind === "responsive-style") return document.querySelector(e.selector);
		if (e.kind === "style" || e.kind === "text" || e.kind === "attribute") {
			let n = document.querySelector(e.selector);
			if (n) {
				let r = t === "undo" ? e.previousRuntimeValue ?? e.previousValue : e.runtimeValue ?? e.value;
				Mt(n, e.property, r);
			}
			return n;
		}
		let n = e.parentSelector ? document.querySelector(e.parentSelector) : null;
		if (!n) return null;
		if (e.kind === "insert") return t === "undo" ? (document.querySelector(e.selector)?.remove(), n) : e.html ? ar(n, e.html, e.index ?? n.children.length) : n;
		if (e.kind === "remove") return t === "undo" ? e.html ? ar(n, e.html, e.index ?? n.children.length) : n : (document.querySelector(e.selector)?.remove(), n);
		let r = t === "undo" ? e.selector : e.previousSelector ?? e.selector, i = t === "undo" ? e.previousSelector : e.selector, a = document.querySelector(r) ?? (i ? document.querySelector(i) : null);
		return a ? (e.stableId && !a.dataset.vtId && (a.dataset.vtId = e.stableId), ir(t === "undo" && e.previousParentSelector ? document.querySelector(e.previousParentSelector) ?? n : n, a, t === "undo" ? e.previousIndex ?? 0 : e.index ?? 0), a) : n;
	}
	let Ca = e(async () => {
		let e = pt ? hn[pt] : null, t = Object.keys(hn).flatMap((e) => {
			let t = gt[e];
			return t ? [`${hn[e].label} selected element: X ${t.x}, Y ${t.y}, ${t.width} x ${t.height} CSS pixels`] : [];
		}).join("; "), n = [e ? `${e.label} ${e.width} x ${e.height} CSS viewport` : "", t].filter(Boolean).join("; "), r = Pt(F, ct, n), i;
		try {
			await navigator.clipboard.writeText(r), i = !0;
		} catch {
			let e = document.activeElement instanceof HTMLElement ? document.activeElement : null, t = document.createElement("textarea");
			t.value = r, t.setAttribute("readonly", ""), t.style.position = "fixed", t.style.left = "-9999px", t.style.opacity = "0", document.body.append(t), t.select();
			try {
				i = document.execCommand("copy");
			} catch {
				i = !1;
			} finally {
				t.remove(), e?.focus();
			}
		}
		window.dispatchEvent(new CustomEvent("visual-truth:send-to-codex", { detail: {
			prompt: r,
			changes: F,
			previewContext: n,
			clipboardCopied: i
		} })), it(!0), window.setTimeout(() => it(!1), 1800);
	}, [
		F,
		ct,
		pt,
		gt
	]), wa = e((e, t) => {
		vt((n) => {
			if (t) return {
				...n,
				[e]: t
			};
			let r = { ...n };
			return delete r[e], r;
		});
	}, []), Ta = e((e = "") => {
		if (!F.length) return;
		let t = Date.now(), n = {
			id: crypto.randomUUID(),
			name: e.trim() || `Version ${$e.length + 1}`,
			timestamp: t,
			changes: structuredClone(F),
			note: ct
		};
		et((e) => [...e, n]);
	}, [
		F,
		$e.length,
		ct
	]), Ea = e((e) => {
		for (let e of [...F].reverse()) Sa(e, "undo");
		gn(document, e.changes), I(structuredClone(e.changes)), L([]), ut(e.note), j(null), Ye(null), nt((e) => e + 1);
	}, [F]), Da = e((e) => {
		et((t) => t.filter((t) => t.id !== e));
	}, []), Oa = e((e, t) => {
		if (!A) return;
		let n = H(A);
		I((r) => r.filter((r) => !(r.kind === "responsive-style" && r.device === e && r.selector === n && r.property === t))), L([]), q();
	}, [A, q]), ka = e((e) => {
		if (!A) return;
		let t = Cr(A, e);
		fn((e) => [t, ...e]), Z(`Saved ${t.name}`);
	}, [A, Z]), Aa = e((e) => {
		let t = tr(A), n = ar(t.parent, e.html, t.index);
		n && (kr(n), I((e) => [...e, jt(n, "insert", t.parent, t.index)]), L([]), J(n), q());
	}, [
		A,
		J,
		q
	]), ja = e(async (e) => {
		try {
			await navigator.clipboard.writeText(Er(e)), Z("Section copied for another project");
		} catch {
			Z("Clipboard access was unavailable");
		}
	}, [Z]), Ma = e(async () => {
		try {
			let e = Tr(await navigator.clipboard.readText());
			if (!e) throw Error("Clipboard does not contain a Visual Truth section.");
			let t = {
				...e,
				id: crypto.randomUUID(),
				createdAt: Date.now(),
				name: `${e.name} imported`
			};
			fn((e) => [t, ...e]), Z("Section imported");
		} catch (e) {
			Z(e instanceof Error ? e.message : "Section could not be imported.");
		}
	}, [Z]), Na = e((e) => {
		if (!A) return;
		let t = wr(A, e);
		mn((e) => [t, ...e]), X(A, "data-vt-style", t.id, `Link to named style "${t.name}"`), Z(`Created ${t.name}`);
	}, [
		A,
		X,
		Z
	]), Pa = e((e) => {
		A && (Xn(e.properties), X(A, "data-vt-style", e.id, `Apply named style "${e.name}"`), Z(`Applied ${e.name}`));
	}, [
		A,
		Xn,
		X,
		Z
	]), Fa = e((e) => {
		if (!A) return;
		let t = {
			...wr(A, e.name),
			id: e.id,
			createdAt: e.createdAt
		};
		mn((n) => n.map((n) => n.id === e.id ? t : n));
		let n = [...document.querySelectorAll(`[data-vt-style="${CSS.escape(e.id)}"]`)];
		n.includes(A) || n.push(A), Zn(n.map((e) => ({
			element: e,
			styles: t.properties
		}))), n.forEach((t) => t.dataset.vtStyle = e.id), Z(`Updated ${e.name} on ${n.length} elements`);
	}, [
		A,
		Zn,
		Z
	]), Ia = e((e) => {
		mn((t) => t.filter((t) => t.id !== e)), document.querySelectorAll(`[data-vt-style="${CSS.escape(e)}"]`).forEach((e) => e.removeAttribute("data-vt-style")), q();
	}, [q]), La = e((e, t) => {
		if (!A) return;
		let n = {
			id: crypto.randomUUID(),
			name: e.trim() || `${Ct(A)} list`,
			templateSelector: H(A),
			bindings: [],
			data: t,
			createdAt: Date.now()
		};
		X(A, "data-vt-repeater-template", n.id, `Create repeater "${n.name}"`), yn((e) => [n, ...e]), Z("Repeater template created");
	}, [
		A,
		X,
		Z
	]), Ra = e((e, t) => {
		if (!A || !Rn || !K || !K.contains(A)) return;
		let n = Dr(K, A);
		yn((r) => r.map((r) => r.id === Rn.id ? {
			...r,
			bindings: [...r.bindings.filter((e) => !(e.selector === n && e.target === t)), {
				selector: n,
				field: e,
				target: t
			}]
		} : r)), Z(`Bound ${e} to ${t}`);
	}, [
		A,
		Rn,
		K,
		Z
	]), za = e((e) => {
		Rn && (yn((t) => t.map((t) => t.id === Rn.id ? {
			...t,
			data: e
		} : t)), Z(`${e.length} data rows ready`));
	}, [Rn, Z]), Ba = e(() => {
		if (!Rn || !K?.parentElement) return;
		let e = K.style.getPropertyValue("display"), t = [...K.parentElement.querySelectorAll(`[data-vt-repeater-instance="${CSS.escape(Rn.id)}"]`)], n = t.map((e) => jt(e, "remove", e.parentElement, sr(e)));
		t.forEach((e) => e.remove());
		let r = Ar(K, Rn), i = r.map((e) => jt(e, "insert", e.parentElement, sr(e))), a = e === "none" ? [] : [kt(K, "display", e, "none")], o = Ni([
			...n,
			...i,
			...a
		]);
		o.length && I((e) => [...e, ...o]), L([]), Ke(r.length ? [r[0]] : [K]), j(r[0] ?? K), q(), Z(`Rendered ${r.length} cards`);
	}, [
		Rn,
		K,
		q,
		Z
	]), Va = e(() => {
		if (!Rn || !K?.parentElement) return;
		let e = [...K.parentElement.querySelectorAll(`[data-vt-repeater-instance="${CSS.escape(Rn.id)}"]`)], t = e.map((e) => jt(e, "remove", e.parentElement, sr(e)));
		e.forEach((e) => e.remove());
		let n = K.style.getPropertyValue("display"), r = K.getAttribute("data-vt-repeater-template") ?? "";
		K.style.removeProperty("display"), K.removeAttribute("data-vt-repeater-template");
		let i = [
			...t,
			...n ? [kt(K, "display", n, "")] : [],
			...r ? [Ot(K, "data-vt-repeater-template", r, "", "Remove repeater template")] : []
		];
		i.length && I((e) => [...e, ...Ni(i)]), L([]), yn((e) => e.filter((e) => e.id !== Rn.id)), J(K), q();
	}, [
		Rn,
		K,
		J,
		q
	]), Ha = e(async () => {
		if (F.length) {
			xn({
				status: "saving",
				message: "Writing generated source..."
			});
			try {
				let e = await fetch("/__visual_truth_apply", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						source: Nr(F),
						changes: F.length
					})
				}), t = await e.json();
				if (!e.ok || !t.ok) throw Error(t.error || "The local source bridge is not configured.");
				xn({
					status: "saved",
					file: t.file,
					message: `${F.length} changes written`
				}), window.dispatchEvent(new CustomEvent("visual-truth:source-applied", { detail: {
					changes: F,
					file: t.file
				} }));
			} catch (e) {
				xn({
					status: "error",
					message: e instanceof Error ? e.message : "Could not write source."
				});
			}
		}
	}, [F]), Ua = e(async () => {
		let e = F.filter((e) => !T.has(e.id));
		if (e.length) {
			xn({
				status: "saving",
				message: "Writing selected changes to local source…"
			});
			try {
				let t = await fetch("/__visual_truth_apply", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						source: Nr(e),
						changes: e.length
					})
				}), n = await t.json();
				if (!t.ok || !n.ok) throw Error(n.error || "The local source bridge is not configured.");
				xn({
					status: "saved",
					file: n.file,
					message: `${e.length} selected changes written locally`
				}), window.dispatchEvent(new CustomEvent("visual-truth:source-applied", { detail: {
					changes: e,
					file: n.file
				} }));
			} catch (e) {
				xn({
					status: "error",
					message: e instanceof Error ? e.message : "Could not write source."
				});
			}
		}
	}, [F, T]), Wa = e((e) => {
		if (!A) return;
		let t = e === "parent" ? A.parentElement : e === "previous" ? A.previousElementSibling : e === "next" ? A.nextElementSibling : A.firstElementChild;
		!t || t === document.body || t === document.documentElement || xt(t) || J(t);
	}, [A, J]);
	t(() => {
		let e = (e) => {
			if (!c || U || !A || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
			let t = e.metaKey || e.ctrlKey;
			if (t && e.key.toLowerCase() === "z") {
				e.preventDefault(), e.shiftKey ? Qi() : Hi();
				return;
			}
			if (t && e.key.toLowerCase() === "d") {
				e.preventDefault(), ha();
				return;
			}
			if (t && !e.shiftKey && e.key.toLowerCase() === "c") {
				e.preventDefault(), ga();
				return;
			}
			if (t && !e.shiftKey && e.key.toLowerCase() === "v") {
				e.preventDefault(), _a();
				return;
			}
			if (e.key === "Backspace" || e.key === "Delete") {
				e.preventDefault(), va();
				return;
			}
			e.key === "Enter" && Nt(A) && (e.preventDefault(), Gr());
		};
		return window.addEventListener("keydown", e), () => window.removeEventListener("keydown", e);
	}, [
		c,
		U,
		A,
		Hi,
		Qi,
		ha,
		ga,
		_a,
		va,
		Gr
	]);
	let Ga = A ? `${Ct(A)} · ${H(A)}` : "Click anything on the page to select it", Ka = jr(A, F), qa = Nt(A), Ja = !!(A?.parentElement && A.parentElement !== document.body && A.tagName !== "MAIN"), Ya = (e, t) => {
		if (!A || R === "all") return t;
		let n = H(A), r = [...F].reverse().find((t) => t.kind === "responsive-style" && t.device === R && t.selector === n && t.property === e);
		return r ? r.runtimeValue ?? r.value : t;
	}, Xa = (e, t) => {
		let n = Number.parseFloat(Ya(e, String(t)));
		return Number.isFinite(n) ? n : t;
	}, Za = P ? {
		"margin-top": Xa("margin-top", P.marginTop),
		"margin-right": Xa("margin-right", P.marginRight),
		"margin-bottom": Xa("margin-bottom", P.marginBottom),
		"margin-left": Xa("margin-left", P.marginLeft),
		"padding-top": Xa("padding-top", P.paddingTop),
		"padding-right": Xa("padding-right", P.paddingRight),
		"padding-bottom": Xa("padding-bottom", P.paddingBottom),
		"padding-left": Xa("padding-left", P.paddingLeft),
		gap: Xa("gap", P.gap)
	} : null, Qa = P ? {
		color: Ya("color", P.color),
		backgroundColor: Ya("background-color", P.backgroundColor),
		borderColor: Ya("border-color", P.borderColor),
		borderWidth: Xa("border-width", P.borderWidth),
		borderRadius: Xa("border-radius", P.borderRadius),
		opacity: Xa("opacity", P.opacity) * 100,
		boxShadow: Ya("box-shadow", P.boxShadow)
	} : null, $a = P ? {
		width: Xa("width", P.width),
		height: Xa("height", P.height)
	} : null, eo = P ? {
		fontFamily: Ya("font-family", P.fontFamily),
		fontSize: Xa("font-size", P.fontSize),
		fontWeight: Ya("font-weight", P.fontWeight),
		letterSpacing: Xa("letter-spacing", P.letterSpacing),
		lineHeight: Xa("line-height", P.lineHeight),
		textAlign: Ya("text-align", P.textAlign)
	} : null, to = P ? Ya("translate", `${P.translateX}px ${P.translateY}px`).match(/(-?[\d.]+)px\s+(-?[\d.]+)px/) : null, no = P ? {
		x: to ? Number(to[1]) : P.translateX,
		y: to ? Number(to[2]) : P.translateY
	} : null, ro = !!(P && (P.display === "flex" || P.display === "inline-flex" || P.display === "grid" || P.display === "inline-grid")), io = tr(A), ao = Ct(A || io.parent), oo = () => {
		U && qr(), G(null), ee(!1), l(!1);
	}, so = /* @__PURE__ */ V("div", {
		className: "vt-panel-controls",
		role: "group",
		"aria-label": "Workspace panels",
		children: [/* @__PURE__ */ V("button", {
			className: u ? "open" : "",
			onClick: () => d((e) => !e),
			"aria-label": `${u ? "Hide" : "Show"} Layers panel`,
			"aria-pressed": u,
			title: S ? `${u ? "Hide" : "Show"} Layers panel. Tab hides both panels.` : void 0,
			children: [/* @__PURE__ */ B(Le, { size: 15 }), /* @__PURE__ */ B("span", {
				className: "vt-toolbar-label",
				children: "Layers"
			})]
		}), /* @__PURE__ */ V("button", {
			className: f ? "open" : "",
			onClick: () => p((e) => !e),
			"aria-label": `${f ? "Hide" : "Show"} Design panel`,
			"aria-pressed": f,
			title: S ? `${f ? "Hide" : "Show"} Design panel. Tab hides both panels.` : void 0,
			children: [/* @__PURE__ */ B(st, { size: 15 }), /* @__PURE__ */ B("span", {
				className: "vt-toolbar-label",
				children: "Design"
			})]
		})]
	}), co = [...document.querySelectorAll("main > section, main > header, main > footer, body > section, [data-vt-label$=\"section\" i]")].filter((e) => !e.closest("[data-visual-truth-ui]")), lo = () => {
		let e = document.querySelector("[data-vt-workspace-canvas=\"true\"]"), t = document.querySelector("main") ?? e?.firstElementChild;
		!e || !t || E(Math.max(.25, Math.min(1, e.clientWidth / Math.max(1, t.scrollWidth))));
	}, uo = () => {
		let e = document.querySelector("[data-vt-workspace-canvas=\"true\"]");
		if (!e || !A) return;
		let t = A.getBoundingClientRect();
		E(Math.max(.25, Math.min(2, Math.min((e.clientWidth - 80) / Math.max(1, t.width), (e.clientHeight - 80) / Math.max(1, t.height)) * we))), window.requestAnimationFrame(() => A.scrollIntoView({
			block: "center",
			inline: "center"
		}));
	}, fo = () => {
		let e = A?.closest("section, article, header, footer, nav, main");
		e ? (Oe(e), J(e)) : Z("Select a section, card, header, or footer to isolate it");
	}, po = (e) => {
		let t = new Set(Me.flatMap((e) => e.changeIds)), n = F.filter((e) => !t.has(e.id)).map((e) => e.id), r = {
			id: crypto.randomUUID(),
			name: e,
			changeIds: n.length ? n : F.map((e) => e.id),
			enabled: !0,
			createdAt: Date.now()
		};
		Ne((e) => [r, ...e]);
	}, mo = (e) => {
		let t = !e.enabled;
		Ne((n) => n.map((n) => n.id === e.id ? {
			...n,
			enabled: t
		} : n)), he((n) => {
			let r = new Set(n);
			return e.changeIds.forEach((e) => t ? r.delete(e) : r.add(e)), r;
		});
	}, ho = (e) => {
		if (e !== Ie) {
			if (e) for (let e of [...F].reverse()) Sa(e, "undo");
			else for (let e of F) Sa(e, "redo");
			Re(e), q();
		}
	}, go = (e) => {
		ne(e), oe(e === "squarespace" ? "pages" : "layers"), y(e === "squarespace" ? "easy" : "advanced"), d(!0), p(!0), _(!1), ln(!1), pe(!1), ye(!1), xe(!1), Ce(!1), Ge("design");
	}, _o = (e) => {
		if (oe(e), e === "more") {
			_e(!0);
			return;
		}
		if (ln(!1), pe(!1), ye(!1), xe(!1), Ce(!1), e === "add") {
			_(!0), d(!0);
			return;
		}
		if (e === "pages" || e === "layers") {
			_(!1), d(!0);
			return;
		}
		if (e === "theme") {
			y("advanced"), ln(!0), p(!0);
			return;
		}
		if (e === "content") {
			y("easy"), xe(!0), p(!0);
			return;
		}
		y("easy"), ye(!0), p(!0);
	}, vo = [
		{
			id: "add",
			label: "Add an element",
			hint: "A",
			run: () => {
				_(!0), d(!0), pe(!1);
			}
		},
		{
			id: "select",
			label: "Select and edit",
			hint: "V",
			run: () => {
				_(!1), pe(!1);
			}
		},
		{
			id: "undo",
			label: "Undo last change",
			hint: "⌘Z",
			run: Hi
		},
		{
			id: "redo",
			label: "Redo last change",
			hint: "⇧⌘Z",
			run: Qi
		},
		{
			id: "review",
			label: "Review and apply changes",
			run: () => pe(!0)
		},
		{
			id: "quality",
			label: "Open theme and accessibility checks",
			run: () => ye(!0)
		},
		{
			id: "components",
			label: "Open reusable components",
			run: () => {
				xe(!0), Ce(!1), pe(!1);
			}
		},
		{
			id: "content",
			label: "Enter content editing mode",
			run: () => {
				Ce(!0), xe(!1), pe(!1);
			}
		},
		{
			id: "fit-page",
			label: "Fit page in canvas",
			run: lo
		},
		{
			id: "fit-selection",
			label: "Fit selected element",
			run: uo
		},
		{
			id: "isolate",
			label: "Isolate selected section",
			run: fo
		},
		{
			id: "easy",
			label: "Switch to Easy Mode",
			run: () => y("easy")
		},
		{
			id: "advanced",
			label: "Switch to Advanced Mode",
			run: () => y("advanced")
		},
		{
			id: "text",
			label: "Edit selected text",
			run: Gr
		},
		{
			id: "feedback",
			label: "Send feedback",
			hint: "Optional",
			run: () => Vn(!1)
		}
	];
	return a ? null : c ? dt ? /* @__PURE__ */ B(Tn, {
		mode: dt,
		changes: F,
		selectedSelector: A ? H(A) : null,
		selectedLabel: A ? Ct(A) : "",
		onMeasurement: wa,
		onModeChange: (e) => {
			ft(e), e !== "all" && mt(e);
		},
		onClose: () => ft(null)
	}) : /* @__PURE__ */ V("div", {
		className: `vt-root vt-mode-${v} vt-workspace-${b}${se ? " vt-icon-labels" : ""}${S ? "" : " vt-hover-hints-off"}${m ? " vt-chrome-hidden" : ""}${fe ? " vt-review-open" : ""}`,
		"data-workspace-preset": b,
		"data-visual-truth-ui": !0,
		style: {
			"--vt-layers-width": `${Ui(h)}px`,
			"--vt-grid-size": `${on}px`
		},
		children: [
			!m && v === "advanced" && Jt ? /* @__PURE__ */ B("div", { className: "vt-canvas-grid" }) : null,
			!m && v === "advanced" && Xt ? /* @__PURE__ */ B(Qn, {
				unit: Qt,
				guides: Pe,
				onUnitChange: $t,
				onGuidesChange: D
			}) : null,
			!m && v === "easy" ? /* @__PURE__ */ V("div", {
				className: "vt-toolbar vt-toolbar-easy",
				role: "toolbar",
				"aria-label": "Visual editing tools",
				onContextMenu: Bn,
				children: [
					/* @__PURE__ */ V("div", {
						className: "vt-toolbar-brand",
						"aria-label": "Visual Truth",
						children: [/* @__PURE__ */ B("img", {
							className: "vt-toolbar-wordmark",
							src: Fr,
							alt: "Visual Truth"
						}), /* @__PURE__ */ B("img", {
							className: "vt-toolbar-mark",
							src: Pr,
							alt: "Visual Truth"
						})]
					}),
					/* @__PURE__ */ B(oi, {
						value: b,
						onChange: go
					}),
					/* @__PURE__ */ V("button", {
						className: g ? "active" : "",
						onClick: () => {
							_(!0), d(!0), pe(!1);
						},
						title: S ? "Add elements" : void 0,
						children: [/* @__PURE__ */ B(Ze, { size: 17 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Add"
						})]
					}),
					/* @__PURE__ */ V("button", {
						className: !g && !fe && !Se && !be ? "active" : "",
						onClick: () => {
							_(!1), pe(!1), Ce(!1), xe(!1);
						},
						title: S ? "Select and edit" : void 0,
						children: [/* @__PURE__ */ B(qe, { size: 17 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Select"
						})]
					}),
					/* @__PURE__ */ V("button", {
						className: Se ? "active" : "",
						onClick: () => {
							Ce((e) => !e), xe(!1), pe(!1), ye(!1);
						},
						title: S ? "Edit content without layout controls" : void 0,
						children: [/* @__PURE__ */ B(ht, { size: 17 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Content"
						})]
					}),
					/* @__PURE__ */ V("button", {
						className: be ? "active-subtle" : "",
						"aria-label": "Reusable components",
						onClick: () => {
							xe((e) => !e), Ce(!1), pe(!1), ye(!1);
						},
						title: S ? "Reusable components" : void 0,
						children: [/* @__PURE__ */ B(re, { size: 17 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Blocks"
						})]
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ V("button", {
						onClick: Hi,
						disabled: !F.length,
						"aria-label": "Undo",
						title: S ? "Undo" : void 0,
						children: [/* @__PURE__ */ B(_t, { size: 17 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Undo"
						})]
					}),
					/* @__PURE__ */ V("button", {
						onClick: Qi,
						disabled: !Xe.length,
						"aria-label": "Redo",
						title: S ? "Redo" : void 0,
						children: [/* @__PURE__ */ B(Qe, { size: 17 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Redo"
						})]
					}),
					/* @__PURE__ */ B(wn, {
						value: pt,
						showHoverHints: S,
						onChange: (e) => {
							ft(e), e !== "all" && mt(e);
						}
					}),
					/* @__PURE__ */ B("button", {
						className: `vt-scope-chip${R === "all" ? "" : " scoped"}`,
						"data-short": R === "all" ? "All" : R === "desktop" ? "Desk" : R === "tablet" ? "iPad" : "Phone",
						onClick: () => yt((e) => e === "all" ? "desktop" : e === "desktop" ? "tablet" : e === "tablet" ? "phone" : "all"),
						title: "Choose which devices receive edits",
						children: R === "all" ? "All devices" : R === "tablet" ? "iPad only" : `${R[0].toUpperCase()}${R.slice(1)} only`
					}),
					/* @__PURE__ */ V("button", {
						className: ve ? "active-subtle" : "",
						onClick: () => {
							ye((e) => !e), pe(!1);
						},
						title: S ? "Theme and accessibility" : void 0,
						children: [/* @__PURE__ */ B(lt, { size: 17 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Checks"
						})]
					}),
					/* @__PURE__ */ V("button", {
						onClick: () => _e(!0),
						"aria-label": "Search commands",
						title: S ? "Search commands (Command K)" : void 0,
						children: [/* @__PURE__ */ B(me, { size: 17 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Search"
						})]
					}),
					so,
					/* @__PURE__ */ V("div", {
						className: "vt-toolbar-endcap",
						children: [
							/* @__PURE__ */ V("button", {
								className: "vt-apply",
								onClick: () => {
									pe(!0), ye(!1), p(!0);
								},
								children: [b === "squarespace" ? "Save" : b === "elementor" ? "Update" : "Apply changes", F.length ? /* @__PURE__ */ B("span", { children: F.length }) : null]
							}),
							/* @__PURE__ */ V("div", {
								className: "vt-mode-switch",
								role: "group",
								"aria-label": "Editor mode",
								children: [/* @__PURE__ */ B("button", {
									className: "active",
									"aria-pressed": "true",
									children: "Easy"
								}), /* @__PURE__ */ B("button", {
									onClick: () => {
										y("advanced"), pe(!1), ye(!1);
									},
									children: "Advanced"
								})]
							}),
							/* @__PURE__ */ B("button", {
								className: "vt-editor-minimize",
								onClick: oo,
								"aria-label": "Close Visual Truth",
								title: S ? "Close Visual Truth" : void 0,
								children: /* @__PURE__ */ B(bt, {
									size: 21,
									strokeWidth: 2.2
								})
							})
						]
					})
				]
			}) : null,
			!m && v === "advanced" ? /* @__PURE__ */ V("div", {
				className: "vt-toolbar",
				role: "toolbar",
				"aria-label": "Visual editing tools",
				onContextMenu: Bn,
				children: [
					/* @__PURE__ */ V("div", {
						className: "vt-toolbar-brand",
						"aria-label": "Visual Truth",
						children: [/* @__PURE__ */ B("img", {
							className: "vt-toolbar-wordmark",
							src: Fr,
							alt: "Visual Truth"
						}), /* @__PURE__ */ B("img", {
							className: "vt-toolbar-mark",
							src: Pr,
							alt: "Visual Truth"
						})]
					}),
					/* @__PURE__ */ B(oi, {
						value: b,
						onChange: go
					}),
					/* @__PURE__ */ V("button", {
						className: g ? "active" : "",
						onClick: () => {
							_((e) => !e), d(!0);
						},
						title: S ? "Add elements" : void 0,
						children: [/* @__PURE__ */ B(Ze, { size: 16 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Add"
						})]
					}),
					/* @__PURE__ */ V("button", {
						className: "active",
						title: S ? "Select and move" : void 0,
						children: [/* @__PURE__ */ B(qe, { size: 16 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Select"
						})]
					}),
					/* @__PURE__ */ V("button", {
						className: en ? "active-subtle" : "",
						"aria-label": "Magnetic snapping",
						"aria-pressed": en,
						onClick: () => tn((e) => !e),
						title: S ? en ? "Turn magnetic snapping off" : "Turn magnetic snapping on" : void 0,
						children: [/* @__PURE__ */ B(We, { size: 16 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Snap"
						})]
					}),
					/* @__PURE__ */ V("button", {
						className: Jt ? "active-subtle" : "",
						"aria-label": "Alignment grid",
						"aria-pressed": Jt,
						onClick: () => Yt((e) => !e),
						title: S ? Jt ? "Hide alignment grid" : "Show alignment grid" : void 0,
						children: [/* @__PURE__ */ B(ke, { size: 16 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Grid"
						})]
					}),
					/* @__PURE__ */ V("button", {
						className: cn && f ? "active" : "",
						"aria-pressed": cn && f,
						onClick: () => {
							p(!0), ln((e) => !e);
						},
						title: S ? "Open Studio tools" : void 0,
						children: [/* @__PURE__ */ B(st, { size: 16 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Studio"
						})]
					}),
					so,
					/* @__PURE__ */ V("button", {
						onClick: Gr,
						disabled: !qa,
						title: S ? "Edit selected text" : void 0,
						children: [/* @__PURE__ */ B(ht, { size: 16 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Text"
						})]
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ V("button", {
						onClick: Hi,
						disabled: !F.length,
						"aria-label": "Undo",
						title: S ? "Undo" : void 0,
						children: [/* @__PURE__ */ B(_t, { size: 16 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Undo"
						})]
					}),
					/* @__PURE__ */ V("button", {
						onClick: Qi,
						disabled: !Xe.length,
						"aria-label": "Redo",
						title: S ? "Redo" : void 0,
						children: [/* @__PURE__ */ B(Qe, { size: 16 }), /* @__PURE__ */ B("span", {
							className: "vt-toolbar-label",
							children: "Redo"
						})]
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ B(wn, {
						value: pt,
						showHoverHints: S,
						onChange: (e) => {
							ft(e), e !== "all" && mt(e);
						}
					}),
					/* @__PURE__ */ B("i", {}),
					/* @__PURE__ */ V("button", {
						className: "vt-toolbar-status",
						title: S ? at ? "Browser storage is full; remove a large local image or saved version" : "Visual edits are saved in this browser" : void 0,
						children: [/* @__PURE__ */ B("span", { className: `vt-saved-dot ${at ? "error" : ""}` }), at ? "Not saved locally" : F.length ? `${F.length} saved locally` : "Ready"]
					}),
					/* @__PURE__ */ V("div", {
						className: "vt-toolbar-endcap",
						children: [
							/* @__PURE__ */ V("button", {
								className: "vt-finish",
								onClick: oo,
								children: [/* @__PURE__ */ B(ie, { size: 16 }), b === "squarespace" ? "Save" : b === "elementor" ? "Update" : "Finish editing"]
							}),
							/* @__PURE__ */ V("div", {
								className: "vt-mode-switch vt-mode-switch-advanced",
								role: "group",
								"aria-label": "Editor mode",
								children: [/* @__PURE__ */ B("button", {
									onClick: () => {
										y("easy"), ln(!1);
									},
									children: "Easy"
								}), /* @__PURE__ */ B("button", {
									className: "active",
									"aria-pressed": "true",
									children: "Advanced"
								})]
							}),
							/* @__PURE__ */ B("button", {
								className: "vt-editor-minimize",
								onClick: oo,
								"aria-label": "Close Visual Truth",
								title: S ? "Close Visual Truth" : void 0,
								children: /* @__PURE__ */ B(bt, {
									size: 21,
									strokeWidth: 2.2
								})
							})
						]
					})
				]
			}) : null,
			m ? null : /* @__PURE__ */ B(ci, {
				preset: b,
				activeTool: ae,
				onTool: _o,
				onDisplayMenu: Bn
			}),
			!m && u && (g ? /* @__PURE__ */ B(Lt, {
				targetLabel: ao,
				placement: v === "easy" ? k === "before" ? "before" : k === "after" ? "after" : "inside" : io.placement,
				onAdd: ua,
				onClose: () => _(!1),
				sections: un,
				onInsertSection: Aa
			}) : v === "easy" ? /* @__PURE__ */ B(Qr, {
				selected: A,
				onSelect: J,
				onIsolate: (e) => {
					Oe(e), J(e);
				},
				revision: tt
			}) : /* @__PURE__ */ B(dn, {
				selected: A,
				onSelect: J,
				onReorder: xa,
				revision: tt,
				width: Ui(h),
				onWidthChange: te
			})),
			!m && v === "easy" && f ? fe ? /* @__PURE__ */ B(Ur, {
				changes: F,
				selectedIds: new Set(F.filter((e) => !T.has(e.id)).map((e) => e.id)),
				sessions: Me,
				comparing: Ie,
				onToggle: (e) => he((t) => {
					let n = new Set(t);
					return n.has(e) ? n.delete(e) : n.add(e), n;
				}),
				onToggleSession: mo,
				onCreateSession: po,
				onCompare: ho,
				onRevert: na,
				onSaveVersion: () => Ta("Before applying changes"),
				onApply: () => void Ua(),
				applying: bn.status === "saving",
				applyMessage: bn.status === "saved" || bn.status === "error" ? bn.message ?? "" : ""
			}) : be ? /* @__PURE__ */ B(ri, {
				components: Ae,
				selected: A,
				onCreate: da,
				onInsert: fa,
				onUpdate: pa,
				onDelete: ma,
				onClose: () => xe(!1)
			}) : Se ? /* @__PURE__ */ B(ii, {
				selected: A,
				onAttribute: Br,
				onText: zr,
				onEditText: Gr,
				onClose: () => Ce(!1)
			}) : ve ? /* @__PURE__ */ B(Jr, {
				selected: A,
				onStyle: Y,
				onClose: () => ye(!1)
			}) : /* @__PURE__ */ B(Rr, {
				selected: A,
				metrics: P,
				dragBehavior: C,
				onDragBehavior: w,
				onStyle: Y,
				onAttribute: $n,
				onEditText: Gr,
				editScope: R,
				onEditScope: yt,
				onSmartAction: Vr
			}) : null,
			!m && v === "advanced" && f ? cn ? /* @__PURE__ */ B(er, {
				selected: A,
				selectedCount: lr.length,
				grouped: !!ur,
				editScope: R,
				responsiveOverrides: Ka,
				gridVisible: Jt,
				rulersVisible: Xt,
				rulerUnit: Qt,
				rulerGuides: Pe,
				snappingEnabled: en,
				snapToGrid: rn,
				gridSize: on,
				sections: un,
				namedStyles: pn,
				activeRepeater: Rn,
				makeCodeState: bn,
				changeCount: F.length,
				onClose: () => ln(!1),
				onGridVisible: Yt,
				onRulersVisible: Zt,
				onRulerUnit: $t,
				onRulerGuidesChange: D,
				onSnappingEnabled: tn,
				onSnapToGrid: an,
				onGridSize: sn,
				onAlignSelection: dr,
				onDistributeSelection: fr,
				onGroupSelection: pr,
				onUngroupSelection: mr,
				onResetResponsiveProperty: Oa,
				onSaveSection: ka,
				onInsertSection: Aa,
				onCopySection: ja,
				onImportSection: Ma,
				onDeleteSection: (e) => fn((t) => t.filter((t) => t.id !== e)),
				onCreateNamedStyle: Na,
				onApplyNamedStyle: Pa,
				onUpdateNamedStyle: Fa,
				onDeleteNamedStyle: Ia,
				onCreateRepeater: La,
				onBindRepeater: Ra,
				onUpdateRepeaterData: za,
				onRenderRepeater: Ba,
				onDeleteRepeater: Va,
				onMakeItCode: Ha
			}) : /* @__PURE__ */ B(nn, {
				tab: Ue,
				onTabChange: Ge,
				selected: A,
				metrics: P,
				changes: F,
				checkpoints: $e,
				copied: rt,
				note: ct,
				editScope: R,
				onEditScope: yt,
				onResetScope: ea,
				aspectLocked: z,
				onAspectLocked: Tt,
				onStyle: Y,
				onStyleAsset: Jn,
				onAttribute: $n,
				onTranslate: cr,
				onAlign: $,
				onResize: Ir,
				onNudge: hr,
				onScale: Sr,
				onFitParent: Lr,
				onCopy: Ca,
				onResetSelected: $i,
				onClear: ta,
				onRevertChange: na,
				onSaveCheckpoint: Ta,
				onRestoreCheckpoint: Ea,
				onDeleteCheckpoint: Da,
				onNoteChange: ut,
				onEditText: Gr,
				canEditText: qa,
				onMoveSibling: ya,
				onMoveToParent: ba,
				onSelectRelative: Wa,
				onDuplicate: ha,
				onRemove: va,
				canRestructure: Ja
			}) : null,
			!m && v === "easy" ? /* @__PURE__ */ B(ei, {
				selected: A,
				onSelect: J,
				isolated: De,
				onExitIsolation: () => Oe(null)
			}) : null,
			!m && v === "easy" ? /* @__PURE__ */ B(ti, {
				zoom: we,
				panMode: Te,
				isolated: De,
				onZoom: E,
				onFitPage: lo,
				onFitSelection: uo,
				onPanMode: Ee,
				onIsolate: fo,
				onExitIsolation: () => Oe(null),
				sections: co
			}) : null,
			!m && v === "easy" && g && A ? /* @__PURE__ */ V("div", {
				className: "vt-insertion-zones",
				style: {
					left: A.getBoundingClientRect().left,
					top: A.getBoundingClientRect().top,
					width: A.getBoundingClientRect().width,
					height: A.getBoundingClientRect().height
				},
				children: [
					/* @__PURE__ */ B("button", {
						className: k === "before" ? "active before" : "before",
						onClick: () => He("before"),
						onDragOver: (e) => e.preventDefault(),
						onDrop: (e) => {
							e.preventDefault();
							let t = e.dataTransfer.getData("application/x-visual-truth-element");
							t && (He("before"), la(t, "before"));
						},
						children: "Add above"
					}),
					A.matches("main, section, article, header, footer, nav, aside, div, form, ul, ol") ? /* @__PURE__ */ B("button", {
						className: k === "inside" ? "active inside" : "inside",
						onClick: () => He("inside"),
						onDragOver: (e) => e.preventDefault(),
						onDrop: (e) => {
							e.preventDefault();
							let t = e.dataTransfer.getData("application/x-visual-truth-element");
							t && (He("inside"), la(t, "inside"));
						},
						children: "Add inside"
					}) : null,
					/* @__PURE__ */ B("button", {
						className: k === "after" ? "active after" : "after",
						onClick: () => He("after"),
						onDragOver: (e) => e.preventDefault(),
						onDrop: (e) => {
							e.preventDefault();
							let t = e.dataTransfer.getData("application/x-visual-truth-element");
							t && (He("after"), la(t, "after"));
						},
						children: "Add below"
					})
				]
			}) : null,
			!m && lr.length > 1 ? /* @__PURE__ */ B(Yn, {
				elements: lr,
				revision: tt,
				grouped: !!ur,
				onMoveStart: $r,
				onAlign: dr,
				onDistribute: fr,
				onGroup: pr,
				onUngroup: mr
			}) : !m && A && Za && Qa && $a && eo && no ? /* @__PURE__ */ B(Wn, {
				element: A,
				revision: tt,
				editing: U,
				locked: A.getAttribute("data-vt-locked") === "true",
				easyMode: v === "easy",
				canAdjustText: qa,
				textDragBehavior: C,
				onTextDragBehavior: w,
				liveReadout: Ht,
				position: no,
				onTranslate: cr,
				onAlign: $,
				size: $a,
				aspectLocked: z,
				onAspectLocked: Tt,
				onResize: Ir,
				onFitParent: Lr,
				typography: eo,
				onTypography: Y,
				spacing: Za,
				showGap: ro,
				onSpacing: Mr,
				appearance: Qa,
				onAppearance: Y,
				hasChanges: !!F.length,
				copied: rt,
				onSendToCodex: Ca,
				onNudge: hr,
				onScale: Sr,
				onFontSize: Or,
				onMoveStart: (e) => fi("move", e),
				onResizeStart: (e, t) => fi("resize", t, e),
				onDoubleClick: Gr,
				onContextMenu: (e) => {
					e.preventDefault(), e.stopPropagation(), G({
						x: e.clientX,
						y: e.clientY
					});
				}
			}) : null,
			!m && v === "easy" && A && P && !U && !Se && A.matches("main, section, article, header, footer, nav, aside, div, form, ul, ol") ? /* @__PURE__ */ B(ni, {
				selected: A,
				metrics: P,
				onStyle: Y
			}) : null,
			!m && N && document.contains(N) ? /* @__PURE__ */ B("div", {
				className: `vt-hover-outline ${N.closest("[data-vt-locked=\"true\"]") ? "locked" : ""}`,
				style: {
					left: N.getBoundingClientRect().left,
					top: N.getBoundingClientRect().top,
					width: N.getBoundingClientRect().width,
					height: N.getBoundingClientRect().height
				},
				children: /* @__PURE__ */ B("span", {
					style: { top: N.getBoundingClientRect().top < 24 ? 2 : -21 },
					children: Ct(N)
				})
			}) : null,
			!m && Wt ? /* @__PURE__ */ B("div", {
				className: "vt-asset-drop",
				"data-visual-truth-ui": !0,
				style: {
					left: Wt.element.getBoundingClientRect().left,
					top: Wt.element.getBoundingClientRect().top,
					width: Wt.element.getBoundingClientRect().width,
					height: Wt.element.getBoundingClientRect().height
				},
				children: /* @__PURE__ */ V("span", { children: [/* @__PURE__ */ B(Fe, { size: 16 }), Wt.kind === "image" ? "Replace image" : "Set background"] })
			}) : null,
			!m && Kt ? /* @__PURE__ */ V("div", {
				className: "vt-asset-message",
				role: "status",
				children: [/* @__PURE__ */ B(Fe, { size: 15 }), Kt]
			}) : null,
			!m && Bt.x !== null ? /* @__PURE__ */ B("div", {
				className: "vt-snap-guide vertical",
				style: { left: Bt.x }
			}) : null,
			!m && Bt.y !== null ? /* @__PURE__ */ B("div", {
				className: "vt-snap-guide horizontal",
				style: { top: Bt.y }
			}) : null,
			!m && A && P && U ? /* @__PURE__ */ B(Kn, {
				element: A,
				metrics: P,
				onStyle: Y,
				onStyles: Xn,
				onConfirm: qr,
				onCancel: Yr
			}) : null,
			!m && A && W ? /* @__PURE__ */ B(Ft, {
				position: W,
				canEditText: qa,
				canPasteStyles: !!Rt,
				canPasteElement: Fn,
				canRestructure: Ja,
				multiSelected: lr.length > 1,
				grouped: !!ur,
				locked: A.dataset.vtLocked === "true",
				onEditText: Gr,
				onCopyStyles: ra,
				onPasteStyles: ia,
				onCopyElement: ga,
				onPasteElement: _a,
				onMoveLayer: aa,
				onMoveSibling: ya,
				onDuplicate: ha,
				onRemove: va,
				onHide: oa,
				onReset: () => {
					$i(), G(null);
				},
				onRename: sa,
				onLock: ca,
				onSaveSection: () => {
					ka(""), G(null);
				},
				onGroup: () => {
					pr(), G(null);
				},
				onUngroup: () => {
					mr(), G(null);
				},
				onMakeItCode: () => {
					ln(!0), G(null), Ha();
				}
			}) : null,
			!m && ue ? /* @__PURE__ */ B(li, {
				position: ue,
				labelsShown: se,
				hoverHints: S,
				onLabelsShown: x,
				onHoverHints: le,
				onFeedback: () => Vn(!1),
				onClose: () => de(null)
			}) : null,
			!m && v === "advanced" ? /* @__PURE__ */ V("div", {
				className: "vt-statusbar",
				children: [
					/* @__PURE__ */ B("code", { children: Ga }),
					/* @__PURE__ */ B("span", {
						className: `vt-scope-status ${R === "all" ? "" : "scoped"}`,
						children: R === "all" ? "All devices" : R === "tablet" ? "iPad only" : `${R[0].toUpperCase()}${R.slice(1)} only`
					}),
					/* @__PURE__ */ V("span", { children: [
						/* @__PURE__ */ B("i", {}),
						F.length,
						" ",
						F.length === 1 ? "change" : "changes",
						" captured"
					] }),
					/* @__PURE__ */ B("button", {
						onClick: () => Ge("changes"),
						children: "Review changes"
					})
				]
			}) : null,
			!m && v === "easy" && ze < 3 ? /* @__PURE__ */ V("div", {
				className: "vt-onboarding",
				role: "status",
				children: [
					/* @__PURE__ */ V("span", { children: [ze + 1, " of 3"] }),
					/* @__PURE__ */ B("strong", { children: ze === 0 ? "Select something" : ze === 1 ? "Change it visually" : "Apply your changes" }),
					/* @__PURE__ */ B("p", { children: ze === 0 ? "Click text, an image, or a section on the page." : ze === 1 ? "Use the five useful controls shown for your selection." : "Review the readable summary before making it code." }),
					/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("button", {
						onClick: () => {
							window.localStorage.setItem("visual-truth:onboarding-step", "3"), Be(3);
						},
						children: "Skip"
					}), /* @__PURE__ */ B("button", {
						onClick: () => {
							let e = ze + 1;
							window.localStorage.setItem("visual-truth:onboarding-step", String(e)), Be(e);
						},
						children: ze === 2 ? "Done" : "Next"
					})] })
				]
			}) : null,
			!m && Ve && ze >= 3 ? /* @__PURE__ */ V("aside", {
				className: "vt-feedback-prompt",
				"aria-labelledby": "vt-feedback-prompt-title",
				"data-visual-truth-ui": !0,
				children: [
					/* @__PURE__ */ B("button", {
						className: "vt-feedback-prompt-close",
						"aria-label": "Dismiss feedback prompt",
						onClick: Hn,
						children: /* @__PURE__ */ B(bt, { size: 16 })
					}),
					/* @__PURE__ */ B("span", { children: "After a few editing sessions" }),
					/* @__PURE__ */ B("strong", {
						id: "vt-feedback-prompt-title",
						children: "How did Visual Truth work for you?"
					}),
					/* @__PURE__ */ B("p", { children: "Share a rating or idea. Nothing from your project is attached automatically." }),
					/* @__PURE__ */ V("div", { children: [/* @__PURE__ */ B("button", {
						onClick: Hn,
						children: "Not now"
					}), /* @__PURE__ */ B("button", {
						className: "primary",
						onClick: () => Vn(!0),
						children: "Share feedback"
					})] }),
					/* @__PURE__ */ B("button", {
						className: "vt-feedback-prompt-disable",
						onClick: Un,
						children: "Don't ask again"
					})
				]
			}) : null,
			/* @__PURE__ */ B(Kr, {
				open: ge,
				commands: vo,
				onClose: () => _e(!1)
			})
		]
	}) : /* @__PURE__ */ V("button", {
		className: "vt-launcher",
		"data-visual-truth-ui": !0,
		onClick: () => {
			ee(!1), l(!0);
		},
		children: [
			/* @__PURE__ */ B("img", {
				src: Pr,
				alt: ""
			}),
			/* @__PURE__ */ B("span", { children: "Visual Truth" }),
			/* @__PURE__ */ B(ce, { size: 15 })
		]
	});
}
//#endregion
export { hn as PREVIEW_DEVICES, Qi as VisualTruth, Nr as generateDurablePatchSource };
