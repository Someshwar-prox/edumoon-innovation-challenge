"""Rule Engine for AEO Audit.

Performs deterministic checks on the collected AuditEvidence to generate
75% of the final AI Readiness Score and map failures to exact recommendations.
"""
from app.modules.readiness_report.collection import AuditEvidence

# Recommendations mapped to deterministic failures
RULE_RECOMMENDATIONS = {
    "gptbot_blocked": {
        "severity": "critical",
        "title": "GPTBot Blocked",
        "fix": "Remove 'Disallow: /' for User-Agent: GPTBot in your robots.txt file.",
    },
    "claudebot_blocked": {
        "severity": "critical",
        "title": "ClaudeBot Blocked",
        "fix": "Remove 'Disallow: /' for User-Agent: ClaudeBot in your robots.txt file.",
    },
    "perplexity_blocked": {
        "severity": "high",
        "title": "PerplexityBot Blocked",
        "fix": "Remove 'Disallow: /' for User-Agent: PerplexityBot in your robots.txt file.",
    },
    "google_extended_blocked": {
        "severity": "high",
        "title": "Google-Extended Blocked",
        "fix": "Ensure User-Agent: Google-Extended is allowed in your robots.txt file.",
    },
    "missing_organization_schema": {
        "severity": "high",
        "title": "Missing Organization Schema",
        "fix": "Add Organization or LocalBusiness JSON-LD schema to your homepage to define your brand identity to AI.",
    },
    "missing_product_schema": {
        "severity": "medium",
        "title": "Missing Product/Service Schema",
        "fix": "Add Product, Service, or FAQ JSON-LD schema to clearly outline your offerings.",
    },
    "missing_h1": {
        "severity": "high",
        "title": "Missing H1 Tag",
        "fix": "Ensure there is exactly one H1 tag describing the core purpose of the page.",
    },
    "poor_hierarchy": {
        "severity": "medium",
        "title": "Poor Heading Hierarchy",
        "fix": "Use H2 and H3 tags to semantically structure your content.",
    },
    "missing_semantic_tags": {
        "severity": "low",
        "title": "Missing Semantic HTML5 Tags",
        "fix": "Use <article>, <main>, and <nav> tags instead of raw <div> tags to help AI crawlers parse your layout.",
    },
}

def analyze_rules(evidence: AuditEvidence) -> None:
    """Run all deterministic rules and populate the evidence object."""
    recommendations = []
    
    # 1. Accessibility (25 Points Max)
    accessibility_score = 25.0
    robots_lower = evidence.robots_txt_content.lower()
    
    if "user-agent: gptbot" in robots_lower and "disallow: /" in robots_lower.split("user-agent: gptbot")[1][:50]:
        accessibility_score -= 10
        recommendations.append("gptbot_blocked")
        
    if "user-agent: claudebot" in robots_lower and "disallow: /" in robots_lower.split("user-agent: claudebot")[1][:50]:
        accessibility_score -= 10
        recommendations.append("claudebot_blocked")
        
    if "user-agent: perplexitybot" in robots_lower and "disallow: /" in robots_lower.split("user-agent: perplexitybot")[1][:50]:
        accessibility_score -= 5
        recommendations.append("perplexity_blocked")
        
    if "user-agent: google-extended" in robots_lower and "disallow: /" in robots_lower.split("user-agent: google-extended")[1][:50]:
        accessibility_score -= 5
        recommendations.append("google_extended_blocked")
        
    evidence.accessibility = {
        "score": max(0.0, accessibility_score),
        "max_score": 25.0
    }
    
    # 2. Structured Data (25 Points Max)
    structured_data_score = 0.0
    schema_types = []
    for schema in evidence.schema_payloads:
        # Schema can be a dict with "@type"
        if isinstance(schema, dict) and "@type" in schema:
            t = schema.get("@type", "")
            if isinstance(t, list):
                schema_types.extend(t)
            else:
                schema_types.append(t)
                
    schema_types_lower = [t.lower() for t in schema_types if isinstance(t, str)]
    
    has_org = "organization" in schema_types_lower or "localbusiness" in schema_types_lower
    has_product = "product" in schema_types_lower or "service" in schema_types_lower or "faqpage" in schema_types_lower
    
    if has_org:
        structured_data_score += 15.0
    else:
        recommendations.append("missing_organization_schema")
        
    if has_product:
        structured_data_score += 10.0
    elif evidence.schema_payloads:
        # Has schema but not specific ones
        structured_data_score += 5.0
        recommendations.append("missing_product_schema")
    else:
        recommendations.append("missing_product_schema")
        
    evidence.schema_analysis = {
        "score": structured_data_score,
        "max_score": 25.0,
        "found_types": schema_types
    }
    
    # 3. Semantic Structure (25 Points Max)
    semantic_score = 25.0
    if evidence.semantic_elements["h1_count"] == 0:
        semantic_score -= 10.0
        recommendations.append("missing_h1")
        
    if evidence.semantic_elements["h2_count"] == 0:
        semantic_score -= 5.0
        recommendations.append("poor_hierarchy")
        
    if not evidence.semantic_elements["has_main"] and not evidence.semantic_elements["has_article"]:
        semantic_score -= 10.0
        recommendations.append("missing_semantic_tags")
        
    evidence.semantic_structure = {
        "score": max(0.0, semantic_score),
        "max_score": 25.0,
        "h1_count": evidence.semantic_elements["h1_count"],
        "h2_count": evidence.semantic_elements["h2_count"]
    }
    
    # Sum deterministic scores
    evidence.deterministic_score = (
        evidence.accessibility["score"] +
        evidence.schema_analysis["score"] +
        evidence.semantic_structure["score"]
    )
    
    # Map recommendations to the object
    # We will pass this to the LLM to rewrite or just use as is in the final response
    evidence.rule_recommendations = [RULE_RECOMMENDATIONS[r] for r in recommendations if r in RULE_RECOMMENDATIONS]
