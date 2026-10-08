#!/usr/bin/env python3
"""Author, import, lint, repair, merge, extract, and export portable mind maps."""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import math
import os
import re
import sys
import tempfile
import unicodedata
import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Iterable

VERSION = 2
MAX_NODES = 4000
MAX_DEPTH = 64
MAX_INPUT_BYTES = 8 * 1024 * 1024
MAX_OUTPUT_BYTES = 8 * 1024 * 1024
MAX_XML_ELEMENTS = 12_000
MAX_XML_ATTRIBUTES = 48_000
MAX_XML_ATTRIBUTES_PER_ELEMENT = 32
ALLOWED_SYSTEM_SYMLINKS = {Path("/var"), Path("/tmp"), Path("/etc")}
ROOT_KEYS = {"version", "title", "description", "root", "crossLinks"}
NODE_KEYS = {"id", "text", "note", "url", "tags", "status", "priority", "children"}
LINK_KEYS = {"from", "to", "label"}
FORMATS = {"json", "md", "opml", "mm", "mmd", "graphml"}
PORTABLE_MD_NODE_PREFIX = "mindmap-node:"
PORTABLE_MD_DESCRIPTION_PREFIX = "mindmap-description:"
PORTABLE_MD_LINKS_PREFIX = "mindmap-crosslinks:"
PORTABLE_MERMAID_PREFIX = "%% portable-mindmap-v2:"


class ContractError(ValueError): pass


@dataclass(frozen=True)
class Node:
    id: str
    text: str
    note: str | None
    url: str | None
    tags: tuple[str, ...]
    status: str | None
    priority: int | None
    children: tuple["Node", ...]


@dataclass(frozen=True)
class Document:
    title: str
    description: str | None
    root: Node
    cross_links: tuple[tuple[str, str, str | None], ...]


def text(value: Any, field: str, optional: bool = False) -> str | None:
    if value is None and optional: return None
    if not isinstance(value, str) or not value.strip(): raise ContractError(f"{field} must be a non-empty string")
    if len(value) > 10000: raise ContractError(f"{field} is too long")
    for ch in value:
        cp=ord(ch); category=unicodedata.category(ch)
        if category in {"Cc","Cs","Zl","Zp"} or 0xFDD0<=cp<=0xFDEF or cp&0xFFFF in {0xFFFE,0xFFFF}:
            raise ContractError(f"{field} contains unsupported Unicode")
    return value


def strict(value: Any, allowed: set[str], field: str) -> dict[str, Any]:
    if not isinstance(value,dict): raise ContractError(f"{field} must be an object")
    unknown=set(value)-allowed
    if unknown: raise ContractError(f"{field} has unknown fields: {sorted(unknown)}")
    return value


def reject_symlink_ancestors(path:Path)->None:
    current=path
    while current.parent != current:
        if current.is_symlink() and current not in ALLOWED_SYSTEM_SYMLINKS: raise ContractError(f"symbolic-link path component is not allowed: {current}")
        current=current.parent


def read_input(path:Path)->str:
    if path.is_symlink(): raise ContractError("input must not be a symbolic link")
    reject_symlink_ancestors(path.parent)
    if path.stat().st_size>MAX_INPUT_BYTES: raise ContractError("input exceeds 8 MiB")
    return path.read_text(encoding="utf-8")


def cli_path(raw: str, field: str) -> Path:
    """Resolve a user path while retaining an explicit traversal rejection."""
    candidate = Path(raw).expanduser()
    if ".." in candidate.parts:
        raise ContractError(f"{field} must not contain '..' traversal")
    return candidate.absolute()


def parse_xml(path: Path) -> ET.Element:
    """Parse the small portable XML subset after fail-closed entity checks."""
    raw = read_input(path)
    folded = raw.casefold()
    if "<!doctype" in folded or "<!entity" in folded:
        raise ContractError("XML DTD and entity declarations are not allowed")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise ContractError(f"malformed XML: {exc}") from exc
    elements = 0
    attributes = 0
    stack: list[tuple[ET.Element, int]] = [(root, 1)]
    while stack:
        element, depth = stack.pop()
        elements += 1
        attributes += len(element.attrib)
        if elements > MAX_XML_ELEMENTS:
            raise ContractError("XML exceeds the maximum element count")
        if len(element.attrib) > MAX_XML_ATTRIBUTES_PER_ELEMENT:
            raise ContractError("XML element has too many attributes")
        if attributes > MAX_XML_ATTRIBUTES:
            raise ContractError("XML exceeds the maximum attribute count")
        if depth > MAX_DEPTH + 8:
            raise ContractError("XML exceeds the maximum structural depth")
        stack.extend((child, depth + 1) for child in reversed(list(element)))
    return root


def stable_id(path: tuple[int,...], value: str) -> str:
    digest=hashlib.sha256(("/".join(map(str,path))+"\0"+value).encode("utf-8")).hexdigest()[:12]
    return "n_"+digest


def validate_url(value: Any, field: str) -> str | None:
    raw=text(value,field,optional=True)
    if raw is None: return None
    if any(character.isspace() for character in raw) or "\\" in raw:
        raise ContractError(f"{field} must be an http, https, or mailto URL")
    parsed=urllib.parse.urlparse(raw)
    if (
        parsed.scheme not in {"http","https","mailto"}
        or (parsed.scheme in {"http","https"} and not parsed.netloc)
        or (parsed.scheme=="mailto" and (not parsed.path or parsed.netloc))
    ):
        raise ContractError(f"{field} must be an http, https, or mailto URL")
    return raw


def parse(payload: Any) -> Document:
    root=strict(payload,ROOT_KEYS,"document")
    if root.get("version") != VERSION: raise ContractError(f"version must be {VERSION}")
    count=0; ids:set[str]=set()
    def walk(raw: Any, path: tuple[int,...], depth: int) -> Node:
        nonlocal count
        if depth>MAX_DEPTH: raise ContractError("mind map exceeds maximum depth")
        item=strict(raw,NODE_KEYS,"node"); value=text(item.get("text"),"node.text"); assert isinstance(value,str)
        node_id=stable_id(path,value) if "id" not in item else item["id"]
        if not isinstance(node_id,str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.-]{0,127}",node_id): raise ContractError("node.id is invalid")
        if node_id in ids: raise ContractError(f"duplicate node id: {node_id}")
        ids.add(node_id); count+=1
        if count>MAX_NODES: raise ContractError("mind map exceeds maximum node count")
        tags=item.get("tags",[])
        if not isinstance(tags,list) or len(tags)>MAX_NODES: raise ContractError("node.tags must be an array with at most 4000 entries")
        normalized_tags=tuple(sorted(set(str(text(tag,"node tag")) for tag in tags)))
        status=text(item.get("status"),"node.status",optional=True)
        priority=item.get("priority")
        if priority is not None and (isinstance(priority,bool) or not isinstance(priority,int) or not 1<=priority<=9): raise ContractError("node.priority must be 1-9")
        children=item.get("children")
        if not isinstance(children,list) or len(children)>MAX_NODES: raise ContractError("node.children must be an array with at most 4000 entries")
        return Node(node_id,value,text(item.get("note"),"node.note",optional=True),validate_url(item.get("url"),"node.url"),normalized_tags,status,priority,tuple(walk(child,path+(i,),depth+1) for i,child in enumerate(children)))
    node=walk(root.get("root"),(0,),1)
    links_raw=root.get("crossLinks",[])
    if not isinstance(links_raw,list) or len(links_raw)>MAX_NODES: raise ContractError("crossLinks must be an array with at most 4000 entries")
    links=[]; seen_links=set()
    for raw in links_raw:
        item=strict(raw,LINK_KEYS,"crossLink"); start=text(item.get("from"),"crossLink.from"); end=text(item.get("to"),"crossLink.to")
        assert isinstance(start,str) and isinstance(end,str)
        if start not in ids or end not in ids: raise ContractError("crossLink has a dangling node reference")
        key=(start,end)
        if key in seen_links: raise ContractError("duplicate crossLink")
        seen_links.add(key); links.append((start,end,text(item.get("label"),"crossLink.label",optional=True)))
    return Document(str(text(root.get("title"),"title")),text(root.get("description"),"description",optional=True),node,tuple(links))


def node_dict(node: Node) -> dict[str,Any]:
    return {"id":node.id,"text":node.text,"note":node.note,"url":node.url,"tags":list(node.tags),"status":node.status,"priority":node.priority,"children":[node_dict(x) for x in node.children]}


def document_payload(document: Document) -> dict[str, Any]:
    return {
        "version": VERSION,
        "title": document.title,
        "description": document.description,
        "root": node_dict(document.root),
        "crossLinks": [
            {"from": start, "to": end, "label": label}
            for start, end, label in document.cross_links
        ],
    }


def validate_document(document: Document) -> Document:
    """Apply the authored-JSON contract to every imported or transformed tree."""
    try:
        return parse(document_payload(document))
    except RecursionError as exc:
        raise ContractError("mind map exceeds maximum depth") from exc


def canonical(document: Document) -> str:
    return json.dumps(document_payload(document),ensure_ascii=False,indent=2,sort_keys=True)+"\n"


def portable_encode(value: Any) -> str:
    raw=json.dumps(value,ensure_ascii=False,separators=(",",":"),sort_keys=True).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def portable_decode(value: str, field: str) -> Any:
    if not re.fullmatch(r"[A-Za-z0-9_-]+",value): raise ContractError(f"{field} metadata is malformed")
    try:
        padding="="*((4-len(value)%4)%4)
        return json.loads(base64.urlsafe_b64decode(value+padding).decode("utf-8"))
    except (ValueError,UnicodeError,json.JSONDecodeError) as exc:
        raise ContractError(f"{field} metadata is malformed") from exc


def output_record(path:Path)->dict[str,Any]:
    return {"path":str(path),"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"bytes":path.stat().st_size}


def md_escape(value:str)->str:
    result=value.replace("\\","\\\\")
    for ch in "`*_{}[]<>#|": result=result.replace(ch,"\\"+ch)
    return result


def md_unescape(value: str) -> str:
    return re.sub(r"\\([`*_{}\[\]<>#|\\])", r"\1", value)


def markdown(document: Document) -> tuple[str,list[str]]:
    lines=[f"# {md_escape(document.title)}"]
    if document.description:
        lines += ["",md_escape(document.description),f"<!-- {PORTABLE_MD_DESCRIPTION_PREFIX}{portable_encode(document.description)} -->"]
    lines.append("")
    def walk(node:Node,depth:int)->None:
        payload={"id":node.id,"note":node.note,"url":node.url,"tags":list(node.tags),"status":node.status,"priority":node.priority}
        metadata=f" <!-- {PORTABLE_MD_NODE_PREFIX}{portable_encode(payload)} -->"
        lines.append("  "*depth+"- "+md_escape(node.text)+metadata)
        if node.note: lines.append("  "*(depth+1)+"> Note: "+md_escape(node.note.replace("\n"," ")))
        if node.url: lines.append("  "*(depth+1)+"> URL: "+md_escape(node.url))
        for child in node.children: walk(child,depth+1)
    walk(document.root,0)
    if document.cross_links:
        lines += ["","## Cross-links",""]
        for start,end,label in document.cross_links:
            readable=f"{start} → {end}"+(f": {md_escape(label)}" if label else "")
            lines.append(f"- {readable}")
        links=[{"from":start,"to":end,"label":label} for start,end,label in document.cross_links]
        lines.append(f"<!-- {PORTABLE_MD_LINKS_PREFIX}{portable_encode(links)} -->")
    return "\n".join(lines)+"\n",[]


def opml(document:Document)->tuple[str,list[str]]:
    root=ET.Element("opml",{"version":"2.0"}); head=ET.SubElement(root,"head"); ET.SubElement(head,"title").text=document.title
    body=ET.SubElement(root,"body")
    def walk(parent:ET.Element,node:Node)->None:
        attrs={"text":node.text,"_id":node.id}
        if node.note: attrs["_note"]=node.note
        if node.url: attrs["url"]=node.url
        if node.tags: attrs["category"]=",".join(urllib.parse.quote(tag,safe="") for tag in node.tags)
        if node.status: attrs["_status"]=node.status
        if node.priority: attrs["_priority"]=str(node.priority)
        current=ET.SubElement(parent,"outline",attrs)
        for child in node.children: walk(current,child)
    walk(body,document.root); ET.indent(root,space="  ")
    loss=[]
    if document.description: loss.append("OPML output omits the document description")
    if document.cross_links: loss.append("OPML does not preserve cross-links")
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+ET.tostring(root,encoding="unicode",short_empty_elements=True)+"\n",loss


def freemind(document:Document)->tuple[str,list[str]]:
    root=ET.Element("map",{"version":"1.0.1"})
    elements:dict[str,ET.Element]={}
    def walk(parent:ET.Element,node:Node)->None:
        attrs={"ID":node.id,"TEXT":node.text}
        if node.url: attrs["LINK"]=node.url
        current=ET.SubElement(parent,"node",attrs)
        elements[node.id]=current
        if node.note: ET.SubElement(current,"richcontent",{"TYPE":"NOTE"}).text=node.note
        if node.tags: ET.SubElement(current,"attribute",{"NAME":"tags","VALUE":json.dumps(list(node.tags),ensure_ascii=False,separators=(",",":"))})
        if node.status: ET.SubElement(current,"attribute",{"NAME":"status","VALUE":node.status})
        if node.priority: ET.SubElement(current,"attribute",{"NAME":"priority","VALUE":str(node.priority)})
        for child in node.children: walk(current,child)
    walk(root,document.root)
    for start,end,label in document.cross_links:
        attrs={"DESTINATION":end}
        if label: attrs["LABEL"]=label
        ET.SubElement(elements[start],"arrowlink",attrs)
    ET.indent(root,space="  ")
    loss=[]
    loss.append("FreeMind output does not encode the canonical document title")
    if document.description: loss.append("FreeMind output omits the document description")
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+ET.tostring(root,encoding="unicode",short_empty_elements=True)+"\n",loss


def mermaid(document:Document)->tuple[str,list[str]]:
    lines=["mindmap"]
    def clean(value:str)->str:
        normalized=" ".join(value.replace("\t"," ").splitlines())
        normalized=re.sub(r" {2,}"," ",normalized).strip()
        replacements={
            "&":"&amp;", "\\":"&#92;", '"':"&quot;", "'":"&#39;",
            "<":"&lt;", ">":"&gt;", "[":"&#91;", "]":"&#93;",
            "{":"&#123;", "}":"&#125;", "(":"&#40;", ")":"&#41;",
            "|":"&#124;", ";":"&#59;", ":":"&#58;", "=":"&#61;", "%":"&#37;",
            "`":"&#96;",
        }
        return "".join(replacements.get(character,character) for character in normalized)
    node_index=0
    def walk(node:Node,depth:int)->None:
        nonlocal node_index
        visible_id=f"n{node_index}"; node_index+=1
        lines.append("  "*depth+f'{visible_id}["{clean(node.text)}"]')
        for child in node.children: walk(child,depth+1)
    walk(document.root,1)
    lines.append(f"{PORTABLE_MERMAID_PREFIX}{portable_encode(document_payload(document))}")
    source="\n".join(lines)+"\n"
    visible="\n".join(lines[:-1]).casefold()
    if any(token in visible for token in ("<script","<foreignobject","<image","javascript:","vbscript:","@import","%%{")):
        raise ContractError("generated Mermaid contains active or directive content")
    return source,[]


def graphml(document:Document)->tuple[str,list[str]]:
    ns="http://graphml.graphdrawing.org/xmlns"; root=ET.Element("graphml",{"xmlns":ns})
    ET.SubElement(root,"key",{"id":"g_title","for":"graph","attr.name":"title","attr.type":"string"})
    ET.SubElement(root,"key",{"id":"g_description","for":"graph","attr.name":"description","attr.type":"string"})
    node_keys = (("n_text","text"),("n_note","note"),("n_url","url"),("n_tags","tags"),("n_status","status"),("n_priority","priority"))
    for key,name in node_keys:
        ET.SubElement(root,"key",{"id":key,"for":"node","attr.name":name,"attr.type":"string"})
    ET.SubElement(root,"key",{"id":"e_kind","for":"edge","attr.name":"kind","attr.type":"string"})
    ET.SubElement(root,"key",{"id":"e_label","for":"edge","attr.name":"label","attr.type":"string"})
    graph=ET.SubElement(root,"graph",{"id":"mindmap","edgedefault":"directed"}); edge_index=0
    def add_data(parent:ET.Element,key:str,value:Any)->None:
        if value not in (None,"",(),[]): ET.SubElement(parent,"data",{"key":key}).text=str(value)
    add_data(graph,"g_title",document.title); add_data(graph,"g_description",document.description)
    def walk(node:Node,parent:Node|None)->None:
        nonlocal edge_index
        current=ET.SubElement(graph,"node",{"id":node.id}); add_data(current,"n_text",node.text); add_data(current,"n_note",node.note); add_data(current,"n_url",node.url); add_data(current,"n_tags",json.dumps(list(node.tags),ensure_ascii=False,separators=(",",":"))); add_data(current,"n_status",node.status); add_data(current,"n_priority",node.priority)
        if parent:
            edge=ET.SubElement(graph,"edge",{"id":f"tree_{edge_index}","source":parent.id,"target":node.id})
            add_data(edge,"e_kind","tree")
            edge_index+=1
        for child in node.children: walk(child,node)
    walk(document.root,None)
    for start,end,label in document.cross_links:
        edge=ET.SubElement(graph,"edge",{"id":f"cross_{edge_index}","source":start,"target":end}); edge_index+=1
        add_data(edge,"e_kind","cross")
        add_data(edge,"e_label",label)
    validate_graphml_tree(root)
    ET.indent(root,space="  ")
    return '<?xml version="1.0" encoding="UTF-8"?>\n'+ET.tostring(root,encoding="unicode")+"\n",[]


def validate_graphml_tree(root: ET.Element) -> None:
    """Validate the generated, unqualified in-memory GraphML subset."""
    allowed_names={"graph":{"title","description"},"node":{"text","note","url","tags","status","priority"},"edge":{"kind","label"}}
    keys: dict[str, str] = {}
    semantic_keys:set[tuple[str,str]]=set()
    for key in root.findall("./key"):
        key_id=key.get("id"); domain=key.get("for"); name=key.get("attr.name")
        if (
            not key_id or key_id in keys or domain not in allowed_names or
            name not in allowed_names[domain] or key.get("attr.type")!="string" or
            (domain,name) in semantic_keys
        ):
            raise ContractError("GraphML contains an invalid or duplicate key declaration")
        keys[key_id]=domain
        semantic_keys.add((domain,name))
    graph=root.find("./graph")
    if graph is None: raise ContractError("GraphML graph is missing")
    nodes={node.get("id") for node in graph.findall("./node")}
    if None in nodes or len(nodes)!=len(graph.findall("./node")):
        raise ContractError("GraphML node IDs must be present and unique")
    for element,domain in [(graph,"graph"), *((node,"node") for node in graph.findall("./node")), *((edge,"edge") for edge in graph.findall("./edge"))]:
        for data in element.findall("./data"):
            key_id=data.get("key")
            if key_id not in keys or keys[key_id]!=domain:
                raise ContractError("GraphML data references an undeclared or wrong-domain key")
    edge_ids:set[str]=set()
    for edge in graph.findall("./edge"):
        edge_id=edge.get("id")
        if not edge_id or edge_id in edge_ids: raise ContractError("GraphML edge IDs must be present and unique")
        edge_ids.add(edge_id)
        if edge.get("source") not in nodes or edge.get("target") not in nodes:
            raise ContractError("GraphML edge has a dangling endpoint")


def iterate(root:Node)->Iterable[Node]:
    yield root
    for child in root.children: yield from iterate(child)


def import_opml(path:Path)->Document:
    root=parse_xml(path)
    if root.tag!="opml" or root.get("version")!="2.0": raise ContractError("not un-namespaced OPML 2.0")
    if set(root.attrib)!={"version"}: raise ContractError("OPML root contains unsupported attributes")
    heads=root.findall("./head"); bodies=root.findall("./body")
    if len(heads)!=1 or len(bodies)!=1 or any(child.tag not in {"head","body"} for child in root):
        raise ContractError("OPML must contain one head and one body")
    head=heads[0]; body=bodies[0]
    if head.attrib or body.attrib or any(child.tag!="title" for child in head) or len(head.findall("./title"))>1:
        raise ContractError("OPML head or body contains unsupported structure")
    allowed_outline_attributes={"text","category","url","_id","_note","_url","_tags","_status","_priority"}
    for element in body.iter():
        if element is body: continue
        if element.tag!="outline" or set(element.attrib)-allowed_outline_attributes or any(child.tag!="outline" for child in element):
            raise ContractError("OPML contains unsupported outline structure or attributes")
    title_node=head.find("./title"); outlines=body.findall("./outline")
    if len(outlines)!=1: raise ContractError("OPML must have one root outline")
    count=0
    def walk(element:ET.Element,path_:tuple[int,...],depth:int)->Node:
        nonlocal count
        if depth>MAX_DEPTH: raise ContractError("mind map exceeds maximum depth")
        count+=1
        if count>MAX_NODES: raise ContractError("mind map exceeds maximum node count")
        value=element.get("text")
        if not value: raise ContractError("OPML outline lacks text")
        category_tags=tuple(sorted(urllib.parse.unquote(tag) for tag in filter(None,(element.get("category") or "").split(","))))
        legacy_tags=tuple(sorted(urllib.parse.unquote(tag) for tag in filter(None,(element.get("_tags") or "").split(","))))
        if category_tags and legacy_tags and category_tags!=legacy_tags: raise ContractError("OPML category and legacy tag metadata disagree")
        tags=category_tags or legacy_tags
        raw_priority=element.get("_priority")
        if raw_priority:
            try: priority=int(raw_priority)
            except ValueError as exc: raise ContractError("OPML priority must be an integer from 1 to 9") from exc
        else: priority=None
        children=tuple(walk(child,path_+(i,),depth+1) for i,child in enumerate(element.findall("./outline")))
        standard_url=element.get("url"); legacy_url=element.get("_url")
        if standard_url and legacy_url and standard_url!=legacy_url: raise ContractError("OPML standard and legacy URL metadata disagree")
        return Node(element.get("_id") or stable_id(path_,value),value,element.get("_note"),standard_url or legacy_url,tags,element.get("_status"),priority,children)
    return Document((title_node.text if title_node is not None and title_node.text else path.stem),None,walk(outlines[0],(0,),1),())


def import_mm(path:Path)->Document:
    root=parse_xml(path); nodes=root.findall("./node")
    if root.tag!="map" or len(nodes)!=1: raise ContractError("FreeMind map must contain one root node")
    count=0; arrow_links:list[tuple[str,str,str|None]]=[]
    def walk(element:ET.Element,path_:tuple[int,...],depth:int)->Node:
        nonlocal count
        if depth>MAX_DEPTH: raise ContractError("mind map exceeds maximum depth")
        count+=1
        if count>MAX_NODES: raise ContractError("mind map exceeds maximum node count")
        value=element.get("TEXT")
        if not value: raise ContractError("FreeMind node lacks TEXT")
        note=element.find("./richcontent[@TYPE='NOTE']")
        node_id=element.get("ID") or stable_id(path_,value)
        attributes={item.get("NAME"):item.get("VALUE") for item in element.findall("./attribute") if item.get("NAME")}
        raw_tags=attributes.get("tags")
        if raw_tags:
            try:
                decoded_tags=json.loads(raw_tags)
            except json.JSONDecodeError as exc:
                raise ContractError("FreeMind tags attribute must contain a JSON array") from exc
            if not isinstance(decoded_tags,list): raise ContractError("FreeMind tags attribute must contain a JSON array")
            tags=tuple(sorted(str(text(tag,"FreeMind tag")) for tag in decoded_tags))
        else: tags=()
        raw_priority=attributes.get("priority")
        if raw_priority is not None:
            try: priority=int(raw_priority)
            except ValueError as exc: raise ContractError("FreeMind priority must be an integer from 1 to 9") from exc
        else: priority=None
        for arrow in element.findall("./arrowlink"):
            destination=arrow.get("DESTINATION")
            if not destination: raise ContractError("FreeMind arrowlink lacks DESTINATION")
            arrow_links.append((node_id,destination,arrow.get("LABEL")))
        children=tuple(walk(child,path_+(i,),depth+1) for i,child in enumerate(element.findall("./node")))
        return Node(node_id,value,note.text if note is not None else None,element.get("LINK"),tags,attributes.get("status"),priority,children)
    node=walk(nodes[0],(0,),1); return Document(path.stem,None,node,tuple(arrow_links))


MD_NODE=re.compile(r"^( *)(?:- )(.+?)(?:\s+<!--\s*(.*?)\s*-->)?$")
def import_markdown(path:Path)->Document:
    lines=read_input(path).splitlines()
    if not lines or not lines[0].startswith("# "): raise ContractError("Markdown requires an H1 title")
    records=[]; description: str|None=None; cross_links:tuple[tuple[str,str,str|None],...]=()
    description_lines=[]; seen_node=False; in_cross_links=False
    for line in lines[1:]:
        stripped=line.strip()
        if stripped=="## Cross-links": in_cross_links=True; continue
        if stripped.startswith(f"<!-- {PORTABLE_MD_DESCRIPTION_PREFIX}") and stripped.endswith(" -->"):
            encoded=stripped[len(f"<!-- {PORTABLE_MD_DESCRIPTION_PREFIX}"):-4]
            decoded=portable_decode(encoded,"Markdown description")
            description=text(decoded,"Markdown description",optional=True)
            continue
        if stripped.startswith(f"<!-- {PORTABLE_MD_LINKS_PREFIX}") and stripped.endswith(" -->"):
            encoded=stripped[len(f"<!-- {PORTABLE_MD_LINKS_PREFIX}"):-4]
            decoded=portable_decode(encoded,"Markdown cross-links")
            if not isinstance(decoded,list): raise ContractError("Markdown cross-links metadata must be an array")
            parsed_links=[]
            for index,raw in enumerate(decoded):
                item=strict(raw,LINK_KEYS,f"Markdown cross-links[{index}]")
                start=text(item.get("from"),"crossLink.from"); end=text(item.get("to"),"crossLink.to")
                assert isinstance(start,str) and isinstance(end,str)
                parsed_links.append((start,end,text(item.get("label"),"crossLink.label",optional=True)))
            cross_links=tuple(parsed_links)
            continue
        if in_cross_links: continue
        match=MD_NODE.match(line)
        if match:
            spaces=len(match.group(1))
            if spaces%2: raise ContractError("Markdown indentation must use pairs of spaces")
            raw=md_unescape(match.group(2))
            metadata_raw=match.group(3)
            metadata:dict[str,Any]={}
            if metadata_raw:
                if metadata_raw.startswith(PORTABLE_MD_NODE_PREFIX):
                    decoded=portable_decode(metadata_raw[len(PORTABLE_MD_NODE_PREFIX):],"Markdown node")
                    metadata=strict(decoded,{"id","note","url","tags","status","priority"},"Markdown node metadata")
                elif metadata_raw.startswith("id="):
                    pieces=[piece.strip() for piece in metadata_raw.split(";")]
                    metadata["id"]=pieces[0][3:]
                    for piece in pieces[1:]:
                        if "=" not in piece: continue
                        key,value=piece.split("=",1)
                        if key=="status": metadata["status"]=urllib.parse.unquote(value)
                        elif key=="priority":
                            try: metadata["priority"]=int(value)
                            except ValueError as exc: raise ContractError("Markdown priority must be 1-9") from exc
                        elif key=="tags": metadata["tags"]=[urllib.parse.unquote(item) for item in value.split(",") if item]
                else: raise ContractError("Markdown node metadata is unsupported")
            records.append((spaces//2,raw,metadata))
            seen_node=True
        elif not seen_node and stripped and not stripped.startswith("<!--"):
            description_lines.append(md_unescape(stripped))
    if not records or records[0][0]!=0: raise ContractError("Markdown must contain a root bullet")
    def build(index:int,depth:int,path_:tuple[int,...])->tuple[Node,int]:
        if depth>=MAX_DEPTH: raise ContractError("mind map exceeds maximum depth")
        current_depth,value,metadata=records[index]
        if current_depth!=depth: raise ContractError("Markdown hierarchy skips a level")
        children=[]; cursor=index+1
        while cursor<len(records) and records[cursor][0]>depth:
            if records[cursor][0]!=depth+1: raise ContractError("Markdown hierarchy skips a level")
            child,cursor=build(cursor,depth+1,path_+(len(children),)); children.append(child)
        tags=metadata.get("tags",[])
        if not isinstance(tags,list): raise ContractError("Markdown node tags must be an array")
        return Node(
            metadata.get("id") or stable_id(path_,value),
            value,
            metadata.get("note"),
            metadata.get("url"),
            tuple(tags),
            metadata.get("status"),
            metadata.get("priority"),
            tuple(children),
        ),cursor
    node,end=build(0,0,(0,))
    if end!=len(records): raise ContractError("Markdown contains multiple roots")
    if description is None and description_lines: description="\n".join(description_lines)
    return Document(md_unescape(lines[0][2:].strip()),description,node,cross_links)


def import_mermaid(path:Path)->Document:
    raw=read_input(path).replace("\r\n","\n").replace("\r","\n").rstrip()+"\n"
    lines=raw.splitlines()
    if not lines or lines[0].strip()!="mindmap": raise ContractError("Mermaid input must begin with mindmap")
    markers=[line for line in lines if line.startswith(PORTABLE_MERMAID_PREFIX)]
    if markers:
        if len(markers)!=1 or lines[-1]!=markers[0]: raise ContractError("portable Mermaid metadata must appear exactly once at the end")
        document=parse(portable_decode(markers[0][len(PORTABLE_MERMAID_PREFIX):],"Mermaid mind map"))
        rebuilt,_=mermaid(document)
        if rebuilt!=raw: raise ContractError("portable Mermaid metadata is inconsistent with the visible hierarchy")
        return document
    records=[]
    for line in lines[1:]:
        if not line.strip() or line.lstrip().startswith("%%"): continue
        spaces=len(line)-len(line.lstrip(" "))
        if spaces%2: raise ContractError("Mermaid mind-map indentation must use pairs of spaces")
        depth=spaces//2
        value=line.strip()
        if depth==1 and value.startswith("root(") and value.endswith(")"): value=value[5:-1]
        records.append((depth,value))
    if not records or records[0][0]!=1: raise ContractError("Mermaid mind map must contain one root")
    def build(index:int,depth:int,path_:tuple[int,...])->tuple[Node,int]:
        current_depth,value=records[index]
        if current_depth!=depth: raise ContractError("Mermaid hierarchy skips a level")
        children=[]; cursor=index+1
        while cursor<len(records) and records[cursor][0]>depth:
            if records[cursor][0]!=depth+1: raise ContractError("Mermaid hierarchy skips a level")
            child,cursor=build(cursor,depth+1,path_+(len(children),)); children.append(child)
        return Node(stable_id(path_,value),value,None,None,(),None,None,tuple(children)),cursor
    root,end=build(0,1,(0,))
    if end!=len(records): raise ContractError("Mermaid mind map contains multiple roots")
    return Document(path.stem,None,root,())


def import_graphml(path:Path)->Document:
    root=parse_xml(path)
    graphml_namespace="http://graphml.graphdrawing.org/xmlns"
    if root.tag!=f"{{{graphml_namespace}}}graphml": raise ContractError("GraphML must use the standard GraphML namespace")
    for element in root.iter():
        if not isinstance(element.tag,str) or not element.tag.startswith(f"{{{graphml_namespace}}}"):
            raise ContractError("GraphML contains a foreign or unqualified element")
        element.tag=element.tag[len(graphml_namespace)+2:]
    allowed_children={"graphml":{"key","graph"},"graph":{"data","node","edge"},"node":{"data"},"edge":{"data"},"key":set(),"data":set()}
    allowed_attributes={
        "graphml":set(), "key":{"id","for","attr.name","attr.type"},
        "graph":{"id","edgedefault"}, "node":{"id"},
        "edge":{"id","source","target"}, "data":{"key"},
    }
    for element in root.iter():
        if element.tag not in allowed_children:
            raise ContractError(f"GraphML contains an unsupported element: {element.tag}")
        unknown_attributes=set(element.attrib)-allowed_attributes[element.tag]
        if unknown_attributes:
            raise ContractError(f"GraphML {element.tag} contains unsupported attributes: {sorted(unknown_attributes)}")
        if any(child.tag not in allowed_children[element.tag] for child in element):
            raise ContractError(f"GraphML contains unsupported structure below {element.tag}")
    allowed_names={"graph":{"title","description"},"node":{"text","note","url","tags","status","priority"},"edge":{"kind","label"}}
    keys:dict[str,tuple[str,str]]={}
    key_names:set[tuple[str,str]]=set()
    for element in root.findall("./key"):
        key_id=element.get("id"); domain=element.get("for"); name=element.get("attr.name")
        if not key_id or key_id in keys or domain not in allowed_names or name not in allowed_names[domain] or element.get("attr.type")!="string" or (domain,name) in key_names:
            raise ContractError("GraphML has an invalid key declaration")
        keys[key_id]=(domain,name)
        key_names.add((domain,name))
    graphs=root.findall("./graph")
    if len(graphs)!=1 or graphs[0].get("edgedefault")!="directed": raise ContractError("GraphML must contain one directed graph")
    graph=graphs[0]
    def data_values(element:ET.Element,domain:str)->dict[str,str]:
        result={}
        for data in element.findall("./data"):
            key=data.get("key")
            if key not in keys or keys[key][0]!=domain: raise ContractError("GraphML data references an undeclared or wrong-domain key")
            name=keys[key][1]
            if name in result: raise ContractError("GraphML contains duplicate data for one attribute")
            result[name]=data.text or ""
        return result
    graph_data=data_values(graph,"graph")
    nodes:dict[str,dict[str,Any]]={}
    node_order=[]
    for element in graph.findall("./node"):
        node_id=element.get("id")
        if not node_id or node_id in nodes: raise ContractError("GraphML node IDs must be present and unique")
        values=data_values(element,"node")
        if not values.get("text"): raise ContractError("GraphML node text is required")
        raw_priority=values.get("priority")
        if raw_priority:
            try: priority=int(raw_priority)
            except ValueError as exc: raise ContractError("GraphML priority must be an integer from 1 to 9") from exc
        else: priority=None
        raw_tags=values.get("tags") or ""
        if raw_tags:
            try: decoded_tags=json.loads(raw_tags)
            except json.JSONDecodeError: decoded_tags=[item for item in raw_tags.split(",") if item]
            if not isinstance(decoded_tags,list) or any(not isinstance(item,str) for item in decoded_tags):
                raise ContractError("GraphML tags must be a JSON array of strings or a legacy comma-separated list")
            tags=tuple(decoded_tags)
        else: tags=()
        nodes[node_id]={"text":values["text"],"note":values.get("note") or None,"url":values.get("url") or None,"tags":tags,"status":values.get("status") or None,"priority":priority}
        node_order.append(node_id)
    tree_children={node_id:[] for node_id in nodes}; parents:dict[str,str]={}; cross=[]
    edge_ids:set[str]=set()
    for edge in graph.findall("./edge"):
        edge_id=edge.get("id")
        if not edge_id or edge_id in edge_ids: raise ContractError("GraphML edge IDs must be present and unique")
        edge_ids.add(edge_id)
        start=edge.get("source"); end=edge.get("target")
        if start not in nodes or end not in nodes: raise ContractError("GraphML edge has a dangling endpoint")
        values=data_values(edge,"edge"); kind=values.get("kind")
        if kind=="tree":
            if end in parents: raise ContractError("GraphML tree node has multiple parents")
            parents[end]=start; tree_children[start].append(end)
        elif kind=="cross": cross.append((start,end,values.get("label") or None))
        else: raise ContractError("GraphML edge kind must be tree or cross")
    roots=[node_id for node_id in node_order if node_id not in parents]
    if len(roots)!=1: raise ContractError("GraphML tree must have exactly one root")
    visiting:set[str]=set(); visited:set[str]=set()
    def build(node_id:str)->Node:
        if node_id in visiting: raise ContractError("GraphML tree contains a cycle")
        visiting.add(node_id); values=nodes[node_id]
        children=tuple(build(child_id) for child_id in tree_children[node_id])
        visiting.remove(node_id); visited.add(node_id)
        return Node(node_id,values["text"],values["note"],values["url"],values["tags"],values["status"],values["priority"],children)
    node=build(roots[0])
    if visited!=set(nodes): raise ContractError("GraphML tree contains disconnected or cyclic nodes")
    return Document(graph_data.get("title") or path.stem,graph_data.get("description") or None,node,tuple(cross))


def import_document_with_losses(path:Path)->tuple[Document,list[str]]:
    suffix=path.suffix.lower()
    losses:list[str]=[]
    if suffix==".json": document=parse(json.loads(read_input(path)))
    elif suffix==".opml":
        document=import_opml(path)
        losses.append("OPML input cannot recover a canonical document description or cross-links")
    elif suffix==".mm":
        document=import_mm(path)
        losses.extend([
            "FreeMind input does not carry the canonical document title; the file name is used",
            "FreeMind input cannot recover the canonical document description",
        ])
    elif suffix in {".md",".markdown"}:
        raw=read_input(path)
        document=import_markdown(path)
        if PORTABLE_MD_NODE_PREFIX not in raw:
            losses.append("Markdown without portable node metadata cannot recover stable IDs, notes, URLs, tags, status, or priority")
        if "## Cross-links" in raw and PORTABLE_MD_LINKS_PREFIX not in raw:
            losses.append("Markdown cross-link prose without portable metadata cannot be recovered")
    elif suffix in {".mmd",".mermaid"}:
        raw=read_input(path)
        document=import_mermaid(path)
        if PORTABLE_MERMAID_PREFIX not in raw:
            losses.append("Mermaid mind-map source without portable metadata cannot recover canonical title, IDs, node metadata, or cross-links")
    elif suffix==".graphml": document=import_graphml(path)
    else: raise ContractError("supported imports are .json, .md, .opml, .mm, .mmd, .mermaid, and .graphml")
    return validate_document(document),losses


def import_document(path:Path)->Document:
    return import_document_with_losses(path)[0]


def extract(document:Document,node_id:str)->Document:
    match=next((node for node in iterate(document.root) if node.id==node_id),None)
    if match is None: raise ContractError(f"subtree id not found: {node_id}")
    ids={node.id for node in iterate(match)}
    return validate_document(Document(document.title,document.description,match,tuple(link for link in document.cross_links if link[0] in ids and link[1] in ids)))


def merge(base:Document,incoming:Document)->Document:
    incoming_by_id={node.id:node for node in iterate(incoming.root)}
    def walk(node:Node)->Node:
        replacement=incoming_by_id.get(node.id)
        if replacement is not None: return replacement
        return replace(node,children=tuple(walk(child) for child in node.children))
    merged=walk(base.root)
    base_ids={node.id for node in iterate(base.root)}
    if not (base_ids & set(incoming_by_id)): raise ContractError("merge requires at least one shared stable node id")
    links=tuple(sorted(set(base.cross_links+incoming.cross_links)))
    return validate_document(Document(base.title,base.description,merged,links))


def _node_metadata(node:Node)->tuple[Any,...]:
    return (node.text,node.note,node.url,node.tags,node.status,node.priority)


def _node_indexes(document:Document)->tuple[dict[str,Node],dict[str,str|None],dict[str,int]]:
    nodes:dict[str,Node]={}; parents:dict[str,str|None]={}; order:dict[str,int]={}
    def walk(node:Node,parent:str|None)->None:
        nodes[node.id]=node; parents[node.id]=parent
        for index,child in enumerate(node.children): order[child.id]=index; walk(child,node.id)
    order[document.root.id]=0; walk(document.root,None)
    return nodes,parents,order


def merge_safe(base:Document,incoming:Document,conflict:str)->tuple[Document,list[dict[str,Any]]]:
    if conflict not in {"error","base","incoming"}: raise ContractError("merge conflict mode must be error, base, or incoming")
    base_nodes,base_parents,_=_node_indexes(base); incoming_nodes,incoming_parents,_=_node_indexes(incoming)
    if incoming.root.id not in base_nodes: raise ContractError("merge-safe requires the incoming root ID to exist in the base map")
    diagnostics=[]
    severity="error" if conflict=="error" else "warning"
    resolution="" if conflict=="error" else f"; resolved using {conflict}"
    if base.title!=incoming.title:
        diagnostics.append({"code":"mindmap.conflicting-document-title","severity":severity,"path":"$.title","message":"documents have different titles"+resolution})
    if base.description!=incoming.description:
        diagnostics.append({"code":"mindmap.conflicting-document-description","severity":severity,"path":"$.description","message":"documents have different descriptions"+resolution})
    for node_id in sorted(set(base_nodes)&set(incoming_nodes)):
        if node_id!=incoming.root.id and base_parents[node_id]!=incoming_parents[node_id]:
            diagnostics.append({"code":"mindmap.conflicting-parent","severity":severity,"path":node_id,"message":"shared node has different parents"+resolution})
        if _node_metadata(base_nodes[node_id])!=_node_metadata(incoming_nodes[node_id]):
            diagnostics.append({"code":"mindmap.conflicting-metadata","severity":severity,"path":node_id,"message":"shared node has different text or metadata"+resolution})
    base_links={(start,end):label for start,end,label in base.cross_links}
    incoming_links={(start,end):label for start,end,label in incoming.cross_links}
    for start,end in sorted(set(base_links)&set(incoming_links)):
        if base_links[(start,end)]!=incoming_links[(start,end)]:
            diagnostics.append({"code":"mindmap.conflicting-cross-link","severity":severity,"path":f"{start}->{end}","message":"shared cross-link has different labels"+resolution})
    if diagnostics and conflict=="error":
        raise ContractError("safe merge conflicts: "+"; ".join(f"{item['code']}:{item['path']}" for item in diagnostics))
    selected_nodes=dict(base_nodes)
    for node_id,node in incoming_nodes.items():
        if node_id not in selected_nodes or conflict=="incoming": selected_nodes[node_id]=node
    selected_parents=dict(base_parents)
    for node_id,parent_id in incoming_parents.items():
        if node_id==incoming.root.id: continue
        if node_id not in base_nodes or (base_parents[node_id]!=parent_id and conflict=="incoming"):
            selected_parents[node_id]=parent_id
    for node_id,parent_id in selected_parents.items():
        if node_id==base.root.id:
            if parent_id is not None: raise ContractError("safe merge cannot move the base root")
        elif parent_id not in selected_nodes:
            raise ContractError(f"safe merge parent is missing: {parent_id}")
    for node_id in selected_nodes:
        seen=set(); cursor=node_id
        while cursor is not None:
            if cursor in seen: raise ContractError("safe merge would create a hierarchy cycle")
            seen.add(cursor); cursor=selected_parents.get(cursor)
    children_by_parent:dict[str,list[str]]={node_id:[] for node_id in selected_nodes}
    for parent_id,parent_node in base_nodes.items():
        for child in parent_node.children:
            if selected_parents.get(child.id)==parent_id and child.id not in children_by_parent[parent_id]:
                children_by_parent[parent_id].append(child.id)
    for parent_id,parent_node in incoming_nodes.items():
        for child in parent_node.children:
            if selected_parents.get(child.id)==parent_id and child.id not in children_by_parent[parent_id]:
                children_by_parent[parent_id].append(child.id)
    def rebuild(node_id:str)->Node:
        template=selected_nodes[node_id]
        return replace(template,children=tuple(rebuild(child_id) for child_id in children_by_parent[node_id]))
    for start,end,label in incoming.cross_links:
        key=(start,end)
        if key in base_links and base_links[key]!=label:
            if conflict=="incoming": base_links[key]=label
        else: base_links[key]=label
    title=incoming.title if conflict=="incoming" else base.title
    description=incoming.description if conflict=="incoming" else base.description
    result=Document(title,description,rebuild(base.root.id),tuple((start,end,label) for (start,end),label in sorted(base_links.items())))
    return validate_document(result),diagnostics


def normalized_duplicates(document:Document)->list[dict[str,Any]]:
    grouped:dict[str,list[str]]={}
    for node in iterate(document.root):
        normalized=" ".join(unicodedata.normalize("NFKC",node.text).casefold().split())
        grouped.setdefault(normalized,[]).append(node.id)
    return [
        {"code":"mindmap.duplicate-text","severity":"warning","path":",".join(ids),"message":"nodes have identical normalized text"}
        for _,ids in sorted(grouped.items()) if len(ids)>1
    ]


def diff_documents(left:Document,right:Document)->dict[str,Any]:
    left_nodes,left_parents,left_order=_node_indexes(left); right_nodes,right_parents,right_order=_node_indexes(right)
    shared=sorted(set(left_nodes)&set(right_nodes))
    changed=[]; moved=[]
    fields=("text","note","url","tags","status","priority")
    for node_id in shared:
        before=left_nodes[node_id]; after=right_nodes[node_id]
        changes={field:{"left":getattr(before,field),"right":getattr(after,field)} for field in fields if getattr(before,field)!=getattr(after,field)}
        if changes: changed.append({"id":node_id,"fields":changes})
        if left_parents[node_id]!=right_parents[node_id] or left_order[node_id]!=right_order[node_id]:
            moved.append({"id":node_id,"leftParent":left_parents[node_id],"rightParent":right_parents[node_id],"leftIndex":left_order[node_id],"rightIndex":right_order[node_id]})
    left_links={(a,b,label) for a,b,label in left.cross_links}; right_links={(a,b,label) for a,b,label in right.cross_links}
    return {
        "version":1,
        "added":sorted(set(right_nodes)-set(left_nodes)),
        "removed":sorted(set(left_nodes)-set(right_nodes)),
        "changed":changed,
        "moved":moved,
        "crossLinksAdded":[{"from":a,"to":b,"label":label} for a,b,label in sorted(right_links-left_links,key=lambda x:(x[0],x[1],x[2] or ""))],
        "crossLinksRemoved":[{"from":a,"to":b,"label":label} for a,b,label in sorted(left_links-right_links,key=lambda x:(x[0],x[1],x[2] or ""))],
    }


def reorder_document(document:Document,spec:Any)->tuple[Document,list[str]]:
    root=strict(spec,{"version","orders"},"reorder document")
    if root.get("version")!=1: raise ContractError("reorder document version must be 1")
    orders=root.get("orders")
    if not isinstance(orders,list) or not orders or len(orders)>MAX_NODES: raise ContractError("reorder orders must be an array with 1-4000 entries")
    requested:dict[str,list[str]]={}
    for index,raw in enumerate(orders):
        item=strict(raw,{"parent","children"},f"orders[{index}]")
        parent=text(item.get("parent"),f"orders[{index}].parent"); assert isinstance(parent,str)
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.-]{0,127}",parent): raise ContractError(f"orders[{index}].parent is not a valid node ID")
        children=item.get("children")
        if not isinstance(children,list) or len(children)>MAX_NODES or any(not isinstance(child,str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.-]{0,127}",child) for child in children): raise ContractError("reorder children must be an array of valid node IDs")
        if parent in requested: raise ContractError(f"duplicate reorder parent: {parent}")
        requested[parent]=children
    changes=[]
    def walk(node:Node)->Node:
        children=tuple(walk(child) for child in node.children)
        if node.id not in requested: return replace(node,children=children)
        actual=[child.id for child in children]; wanted=requested.pop(node.id)
        if len(wanted)!=len(set(wanted)) or set(wanted)!=set(actual): raise ContractError(f"reorder for {node.id} must be an exact permutation of its children")
        by_id={child.id:child for child in children}
        if wanted!=actual: changes.append(f"reorder-children:{node.id}")
        return replace(node,children=tuple(by_id[child_id] for child_id in wanted))
    result=walk(document.root)
    if requested: raise ContractError("reorder references unknown parent IDs: "+", ".join(sorted(requested)))
    return validate_document(replace(document,root=result)),changes


def preview_svg(document:Document,layout:str)->str:
    if layout not in {"right","down","radial"}: raise ContractError("preview layout must be right, down, or radial")
    records=[]
    def walk(node:Node,depth:int,parent:str|None)->None:
        records.append((node,depth,parent))
        for child in node.children: walk(child,depth+1,node.id)
    walk(document.root,0,None)
    count=len(records); maximum_depth=max(depth for _,depth,_ in records)
    node_width=220.0; node_height=58.0; header_height=86.0
    leaf_slots:dict[str,float]={}; leaf_cursor=0
    def assign_leaf_slots(node:Node)->float:
        nonlocal leaf_cursor
        if not node.children:
            slot=float(leaf_cursor); leaf_cursor+=1; leaf_slots[node.id]=slot; return slot
        child_slots=[assign_leaf_slots(child) for child in node.children]
        slot=(child_slots[0]+child_slots[-1])/2
        leaf_slots[node.id]=slot
        return slot
    assign_leaf_slots(document.root)
    leaf_count=max(1,leaf_cursor)
    if layout=="radial":
        maximum_radius=maximum_depth*220
        width=max(820,2*(maximum_radius+node_width)); height=width+header_height; center=(width/2,header_height+(height-header_height)/2)
        positions={}
        for node,depth,_ in records:
            if depth==0: node_center=center
            else:
                angle=2*math.pi*leaf_slots[node.id]/leaf_count-math.pi/2; radius=depth*220
                node_center=(center[0]+radius*math.cos(angle),center[1]+radius*math.sin(angle))
            positions[node.id]=(node_center[0]-node_width/2,node_center[1]-node_height/2)
    elif layout=="down":
        width=max(900,leaf_count*280+100); height=header_height+140+(maximum_depth+1)*130
        positions={node.id:(60+leaf_slots[node.id]*280,header_height+50+depth*130) for node,depth,_ in records}
    else:
        width=160+(maximum_depth+1)*290; height=max(520,header_height+leaf_count*104+100)
        positions={node.id:(60+depth*290,header_height+40+leaf_slots[node.id]*104) for node,depth,_ in records}
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{int(width)}" height="{int(height)}" viewBox="0 0 {int(width)} {int(height)}">','<rect width="100%" height="100%" fill="#0b1020"/>','<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.title{fill:#f4f7ff;font-size:22px;font-weight:700}.edge{stroke:#8e78ff;stroke-width:2;fill:none}.cross{stroke:#ffb454;stroke-width:1.6;stroke-dasharray:7 5;fill:none}.node{fill:#17233d;stroke:#65d7b5;stroke-width:1.5}.label{fill:#f4f7ff;font-size:14px}.meta{fill:#9fb0d0;font-size:11px}.crossLabel{fill:#ffd7a1;font-size:10px}</style>',f'<text class="title" x="32" y="36">{html.escape(document.title if len(document.title)<=80 else document.title[:77]+"…")}</text>',f'<text class="meta" x="32" y="58">{layout} layout · portable hierarchy · structural preview</text>']
    def centre(node_id:str)->tuple[float,float]:
        x,y=positions[node_id]
        return x+node_width/2,y+node_height/2
    for node,_,parent in records:
        if parent:
            parent_x,parent_y=positions[parent]; child_x,child_y=positions[node.id]
            if layout=="right":
                start=(parent_x+node_width,parent_y+node_height/2); end=(child_x,child_y+node_height/2)
            elif layout=="down":
                start=(parent_x+node_width/2,parent_y+node_height); end=(child_x+node_width/2,child_y)
            else:
                start=centre(parent); end=centre(node.id)
            parts.append(f'<line class="edge" x1="{start[0]:.2f}" y1="{start[1]:.2f}" x2="{end[0]:.2f}" y2="{end[1]:.2f}"/>')
    for start,end,label in document.cross_links:
        x1,y1=centre(start); x2,y2=centre(end)
        dx=x2-x1; dy=y2-y1; length=max(1.0,math.hypot(dx,dy))
        bend=min(54.0,max(26.0,length*0.14)); control_x=(x1+x2)/2-dy/length*bend; control_y=(y1+y2)/2+dx/length*bend
        parts.append(f'<path class="cross" d="M{x1:.2f},{y1:.2f} Q{control_x:.2f},{control_y:.2f} {x2:.2f},{y2:.2f}"/>')
        if label:
            display=label if len(label)<=44 else label[:41]+"…"
            parts.append(f'<text class="crossLabel" x="{control_x+5:.2f}" y="{control_y-5:.2f}">{html.escape(display)}</text>')
    for node,_,_ in records:
        x,y=positions[node.id]; label=node.text if len(node.text)<=24 else node.text[:21]+"…"; visible_id=node.id if len(node.id)<=30 else node.id[:27]+"…"
        parts.append(f'<g><title>{html.escape(node.text)} · {html.escape(node.id)}</title><rect class="node" x="{x:.2f}" y="{y:.2f}" width="{node_width:.2f}" height="{node_height:.2f}" rx="12"/>')
        parts.append(f'<text class="label" x="{x+12:.2f}" y="{y+29:.2f}">{html.escape(label)}</text>')
        parts.append(f'<text class="meta" x="{x+12:.2f}" y="{y+48:.2f}">{html.escape(visible_id)}</text></g>')
    parts.append('</svg>')
    return "\n".join(parts)+"\n"


def preview(document:Document,output:Path,format_name:str,layout:str,overwrite:bool)->dict[str,Any]:
    svg=preview_svg(document,layout)
    if format_name=="html":
        if output.suffix.lower()!=".html": raise ContractError("HTML preview output must end in .html")
        body='<!doctype html>\n<meta charset="utf-8">\n'+f'<title>{html.escape(document.title)} structural preview</title>\n'+'<style>html{background:#0b1020}body{margin:0;padding:24px}svg{max-width:100%;height:auto}</style>\n'+svg
    else:
        if output.suffix.lower()!=".svg": raise ContractError("SVG preview output must end in .svg")
        body=svg
    atomic(output,body,overwrite)
    return {"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":normalized_duplicates(document),"changes":[],"losses":[],"evidence":"previewed"}


def atomic(path:Path,body:str,overwrite:bool)->None:
    if len(body.encode("utf-8"))>MAX_OUTPUT_BYTES: raise ContractError("output exceeds 8 MiB")
    if ".." in path.parts or path.is_symlink(): raise ContractError("unsafe output path")
    reject_symlink_ancestors(path.parent)
    if path.exists():
        if not overwrite: raise ContractError("output exists; pass --overwrite")
        if not path.is_file(): raise ContractError("output must be a regular file")
    path.parent.mkdir(parents=True,exist_ok=True); fd,raw=tempfile.mkstemp(prefix=f".{path.name}.",dir=path.parent); temp=Path(raw)
    try:
        with os.fdopen(fd,"w",encoding="utf-8",newline="\n") as handle: handle.write(body); handle.flush(); os.fsync(handle.fileno())
        os.replace(temp,path)
    finally: temp.unlink(missing_ok=True)


EXPORTERS={"json":lambda d:(canonical(d),[]),"md":markdown,"opml":opml,"mm":freemind,"mmd":mermaid,"graphml":graphml}


def parse_format_list(raw: str) -> list[str]:
    parts=raw.split(",")
    if not parts or any(not item.strip() for item in parts):
        raise ContractError("--formats must be a non-empty comma-separated list")
    formats=[item.strip() for item in parts]
    if len(formats)!=len(set(formats)):
        raise ContractError("--formats must not contain duplicates")
    unknown=set(formats)-FORMATS
    if unknown: raise ContractError(f"unsupported formats: {sorted(unknown)}")
    return formats


def export(document:Document,base:Path,formats:list[str],overwrite:bool)->dict[str,Any]:
    if base.suffix: raise ContractError("output base must not have an extension")
    if base.is_symlink(): raise ContractError("output base must not be a symbolic link")
    if not formats: raise ContractError("at least one output format is required")
    if len(formats)!=len(set(formats)): raise ContractError("output formats must be unique")
    unknown=set(formats)-FORMATS
    if unknown: raise ContractError(f"unsupported formats: {sorted(unknown)}")
    outputs=[]; losses={}; staged=[]; backups=[]; installed=[]
    try:
        reject_symlink_ancestors(base.parent)
        base.parent.mkdir(parents=True,exist_ok=True)
        targets=[base.with_suffix("."+fmt_name) for fmt_name in formats]
        for target in targets:
            if target.is_symlink(): raise ContractError(f"unsafe output path: {target}")
            reject_symlink_ancestors(target.parent)
            if target.exists() and not overwrite: raise ContractError(f"output exists: {target}")
            if target.exists() and not target.is_file(): raise ContractError(f"output must be a regular file: {target}")
        for fmt_name in formats:
            target=base.with_suffix("."+fmt_name); body,loss=EXPORTERS[fmt_name](document)
            if len(body.encode("utf-8"))>MAX_OUTPUT_BYTES: raise ContractError(f"{fmt_name} output exceeds 8 MiB")
            fd,raw=tempfile.mkstemp(prefix=f".{target.name}.",dir=target.parent); os.close(fd); temp=Path(raw); temp.write_text(body,encoding="utf-8",newline="\n"); staged.append((target,temp)); losses[fmt_name]=loss
        for target,_ in staged:
            if target.exists():
                fd,raw=tempfile.mkstemp(prefix=f".{target.name}.backup.",dir=target.parent); os.close(fd); backup=Path(raw); backup.unlink(); target.rename(backup); backups.append((target,backup))
        for target,temp in staged: os.replace(temp,target); installed.append(target); outputs.append(str(target))
        for _,backup in backups: backup.unlink(missing_ok=True)
    except BaseException:
        for target in installed: target.unlink(missing_ok=True)
        for target,backup in reversed(backups):
            if backup.exists(): backup.rename(target)
        raise
    finally:
        for _,temp in staged: temp.unlink(missing_ok=True)
    return {"outputs":outputs,"outputDetails":[output_record(Path(path)) for path in outputs],"losses":losses,"diagnostics":[],"changes":[]}


def main()->int:
    parser=argparse.ArgumentParser(description=__doc__); sub=parser.add_subparsers(dest="command",required=True)
    p=sub.add_parser("create"); p.add_argument("spec"); p.add_argument("output"); p.add_argument("--formats",default="md,opml,mm"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("import"); p.add_argument("source"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("export"); p.add_argument("source"); p.add_argument("output"); p.add_argument("--formats",default="md,opml,mm"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("lint"); p.add_argument("source")
    p=sub.add_parser("repair"); p.add_argument("source"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("extract"); p.add_argument("source"); p.add_argument("node_id"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("merge"); p.add_argument("base"); p.add_argument("incoming"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("merge-safe"); p.add_argument("base"); p.add_argument("incoming"); p.add_argument("output"); p.add_argument("--conflict",choices=("error","base","incoming"),default="error"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("diff"); p.add_argument("left"); p.add_argument("right"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("reorder"); p.add_argument("source"); p.add_argument("orders"); p.add_argument("output"); p.add_argument("--overwrite",action="store_true")
    p=sub.add_parser("preview"); p.add_argument("source"); p.add_argument("output"); p.add_argument("--format",choices=("svg","html"),default="svg"); p.add_argument("--layout",choices=("right","down","radial"),default="right"); p.add_argument("--overwrite",action="store_true")
    args=parser.parse_args()
    try:
        if args.command=="lint":
            document,input_losses=import_document_with_losses(cli_path(args.source,"source")); diagnostics=normalized_duplicates(document)
            print(json.dumps({"ok":True,"nodes":sum(1 for _ in iterate(document.root)),"diagnostics":diagnostics,"changes":[],"outputs":[],"losses":input_losses,"evidence":"static"},sort_keys=True)); return 0
        if args.command=="import":
            document,input_losses=import_document_with_losses(cli_path(args.source,"source")); output=cli_path(args.output,"output"); atomic(output,canonical(document),args.overwrite)
            print(json.dumps({"ok":True,"output":str(output),"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":normalized_duplicates(document),"changes":[],"losses":input_losses,"evidence":"static"},sort_keys=True)); return 0
        if args.command=="repair":
            document,input_losses=import_document_with_losses(cli_path(args.source,"source")); output=cli_path(args.output,"output"); atomic(output,canonical(document),args.overwrite)
            print(json.dumps({"ok":True,"output":str(output),"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":normalized_duplicates(document),"changes":["normalize-to-canonical-v2"],"losses":input_losses,"evidence":"static"},sort_keys=True)); return 0
        if args.command=="extract":
            imported,input_losses=import_document_with_losses(cli_path(args.source,"source")); document=extract(imported,args.node_id); output=cli_path(args.output,"output"); atomic(output,canonical(document),args.overwrite)
            print(json.dumps({"ok":True,"output":str(output),"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":normalized_duplicates(document),"changes":[f"extract-subtree:{args.node_id}"],"losses":input_losses,"evidence":"static"},sort_keys=True)); return 0
        if args.command=="merge":
            base,base_losses=import_document_with_losses(cli_path(args.base,"base")); incoming,incoming_losses=import_document_with_losses(cli_path(args.incoming,"incoming")); document=merge(base,incoming); output=cli_path(args.output,"output"); atomic(output,canonical(document),args.overwrite)
            print(json.dumps({"ok":True,"output":str(output),"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":normalized_duplicates(document),"changes":["legacy-replace-matching-subtree"],"losses":{"base":base_losses,"incoming":incoming_losses},"warnings":["legacy merge replaces a matching base subtree with the incoming subtree; use merge-safe for non-destructive ID-aware merging"],"evidence":"static"},sort_keys=True)); return 0
        if args.command=="merge-safe":
            base,base_losses=import_document_with_losses(cli_path(args.base,"base")); incoming,incoming_losses=import_document_with_losses(cli_path(args.incoming,"incoming")); document,diagnostics=merge_safe(base,incoming,args.conflict); output=cli_path(args.output,"output"); atomic(output,canonical(document),args.overwrite)
            print(json.dumps({"ok":True,"output":str(output),"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":diagnostics+normalized_duplicates(document),"changes":["merge-by-stable-id"],"losses":{"base":base_losses,"incoming":incoming_losses},"evidence":"static"},sort_keys=True)); return 0
        if args.command=="diff":
            left,left_losses=import_document_with_losses(cli_path(args.left,"left")); right,right_losses=import_document_with_losses(cli_path(args.right,"right")); report=diff_documents(left,right); output=cli_path(args.output,"output"); atomic(output,json.dumps(report,ensure_ascii=False,indent=2,sort_keys=True)+"\n",args.overwrite)
            print(json.dumps({"ok":True,"output":str(output),"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":[],"changes":[],"losses":{"left":left_losses,"right":right_losses},"evidence":"static"},sort_keys=True)); return 0
        if args.command=="reorder":
            imported,input_losses=import_document_with_losses(cli_path(args.source,"source")); document,changes=reorder_document(imported,json.loads(read_input(cli_path(args.orders,"orders")))); output=cli_path(args.output,"output"); atomic(output,canonical(document),args.overwrite)
            print(json.dumps({"ok":True,"output":str(output),"outputs":[str(output)],"outputDetails":[output_record(output)],"diagnostics":normalized_duplicates(document),"changes":changes,"losses":input_losses,"evidence":"static"},sort_keys=True)); return 0
        if args.command=="preview":
            document,input_losses=import_document_with_losses(cli_path(args.source,"source")); report=preview(document,cli_path(args.output,"output"),args.format,args.layout,args.overwrite); report["losses"]=input_losses
            print(json.dumps({"ok":True,**report},sort_keys=True)); return 0
        document,input_losses=import_document_with_losses(cli_path(args.spec if args.command=="create" else args.source,"source"))
        formats=parse_format_list(args.formats)
        result=export(document,cli_path(args.output,"output"),formats,args.overwrite)
        if input_losses:
            result["losses"]={"input":input_losses,**result["losses"]}
        print(json.dumps({"ok":True,**result,"evidence":"static"},sort_keys=True)); return 0
    except RecursionError:
        print(json.dumps({"ok":False,"error":"mind map exceeds maximum depth"},sort_keys=True),file=sys.stderr); return 2
    except (OSError,UnicodeError,json.JSONDecodeError,ET.ParseError,ContractError,ValueError) as exc:
        print(json.dumps({"ok":False,"error":str(exc)},sort_keys=True),file=sys.stderr); return 2


if __name__=="__main__": raise SystemExit(main())
