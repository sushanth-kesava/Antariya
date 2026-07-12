"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRef, useState } from "react";
import { Download, FileText } from "lucide-react";
import { jsPDF } from "jspdf";

interface Policy {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
}

const policies: Policy[] = [
  {
    id: "privacy",
    title: "Privacy Policy",
    description: "How we collect and protect your personal information",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya is committed to protecting the privacy, safety, and personal information of all customers, users, partners, and business operations associated with the platform.</p>
        <p><span className="font-semibold text-foreground">2.</span> By accessing or using the Antariya website, users agree to the collection, storage, and usage of information as described in this Privacy Policy and related platform policies.</p>
        <p><span className="font-semibold text-foreground">3.</span> Antariya may collect personal information including full name, email address, mobile number, shipping address, billing address, account details, and order-related information for business and operational purposes.</p>
        <p><span className="font-semibold text-foreground">4.</span> Customer information is collected strictly for lawful purposes including order processing, payment verification, customer support, shipping, account management, fraud prevention, and service improvement.</p>
        <p><span className="font-semibold text-foreground">5.</span> All payment transactions are securely processed through trusted third-party payment gateways that follow industry-standard encryption and security practices.</p>
        <p><span className="font-semibold text-foreground">6.</span> Antariya does not directly store sensitive payment details including full debit card numbers, credit card numbers, CVV information, UPI PINs, OTPs, or internet banking passwords.</p>
        <p><span className="font-semibold text-foreground">7.</span> Customers are responsible for ensuring that the information provided during registration, checkout, or communication is accurate, complete, and not misleading.</p>
        <p><span className="font-semibold text-foreground">8.</span> Antariya reserves the right to cancel, suspend, or investigate orders, accounts, or activities suspected to involve fraud, scams, unauthorized transactions, false identity usage, chargeback abuse, or harmful activities.</p>
        <p><span className="font-semibold text-foreground">9.</span> Technical information such as IP address, browser type, device information, login activity, cookies, and website interaction data may be automatically collected for security monitoring, analytics, fraud detection, and platform optimization.</p>
        <p><span className="font-semibold text-foreground">10.</span> Cookies and tracking technologies may be used to improve user experience, remember preferences, maintain account sessions, personalize content, and strengthen website security.</p>
        <p><span className="font-semibold text-foreground">11.</span> Customer information may be shared only with authorized logistics providers, payment processors, technical support services, legal authorities, or government agencies when required for legitimate business or legal purposes.</p>
        <p><span className="font-semibold text-foreground">12.</span> Antariya does not sell, rent, leak, or intentionally share customer personal data with unauthorized third parties for commercial exploitation.</p>
        <p><span className="font-semibold text-foreground">13.</span> Reasonable technical and organizational safeguards including encrypted systems, secured databases, restricted access controls, and monitoring systems are implemented to protect customer and business data from unauthorized access or misuse.</p>
        <p><span className="font-semibold text-foreground">14.</span> Users are responsible for maintaining the confidentiality of their account credentials, passwords, OTPs, and login information, and Antariya will not be responsible for losses caused by customer negligence or unauthorized account sharing.</p>
        <p><span className="font-semibold text-foreground">15.</span> Any attempt to misuse the platform, access restricted systems, manipulate orders, copy content, exploit vulnerabilities, spread malware, or interfere with website operations may result in account suspension, legal action, and reporting to authorities.</p>
        <p><span className="font-semibold text-foreground">16.</span> Antariya reserves the right to verify customer identities, payment authenticity, shipping information, and transaction legitimacy whenever necessary to protect both customers and business operations from fraud or abuse.</p>
        <p><span className="font-semibold text-foreground">17.</span> In cases involving suspicious activities, disputed transactions, payment reversals, fake return claims, abusive behavior, or policy violations, Antariya may temporarily hold orders, deny refunds, restrict accounts, or initiate investigations.</p>
        <p><span className="font-semibold text-foreground">18.</span> The Antariya website may contain third-party integrations, external links, or social media connections, and Antariya is not responsible for the privacy practices, security standards, or content of external platforms.</p>
        <p><span className="font-semibold text-foreground">19.</span> Users may request access, correction, modification, or deletion of eligible personal information by contacting Antariya through official communication channels, subject to applicable legal and operational requirements.</p>
        <p><span className="font-semibold text-foreground">20.</span> Antariya reserves the right to modify, update, enforce, or revise this Privacy Policy at any time to maintain platform safety, legal compliance, customer protection, and business security, and continued use of the platform constitutes acceptance of such updates.</p>
      </div>
    ),
  },
  {
    id: "terms",
    title: "Terms & Conditions",
    description: "Rules and guidelines for using Antariya platform",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> By accessing or using Antariya, users agree to comply with all terms, conditions, policies, and guidelines mentioned on the platform.</p>
        <p><span className="font-semibold text-foreground">2.</span> Antariya is an embroidery-focused fashion and merchandise brand that provides apparel, customized products, and limited-edition merchandise through online platforms and associated services.</p>
        <p><span className="font-semibold text-foreground">3.</span> Users must provide accurate, complete, and genuine information while placing orders, creating accounts, making payments, or communicating with Antariya.</p>
        <p><span className="font-semibold text-foreground">4.</span> Antariya reserves the right to refuse, cancel, suspend, or limit any order, account, or service if suspicious, fraudulent, abusive, or unauthorized activities are detected.</p>
        <p><span className="font-semibold text-foreground">5.</span> All product images, mockups, embroidery designs, prints, colors, dimensions, and visuals displayed on the website are for representation purposes, and minor variations may occur due to lighting, screens, fabric texture, embroidery process, or manufacturing limitations.</p>
        <p><span className="font-semibold text-foreground">6.</span> Prices listed on the Antariya platform are displayed in Indian Rupees (INR) and may change at any time without prior notice depending on product availability, production cost, market conditions, or promotional campaigns.</p>
        <p><span className="font-semibold text-foreground">7.</span> Orders will be processed only after successful payment confirmation through approved payment methods and secure payment gateways integrated with the platform.</p>
        <p><span className="font-semibold text-foreground">8.</span> Antariya reserves the right to cancel or reject orders involving payment failures, pricing errors, stock unavailability, duplicate transactions, suspicious payment activity, or violations of company policies.</p>
        <p><span className="font-semibold text-foreground">9.</span> Customized, made-to-order, embroidery-based, or limited-edition products may require additional production time and are generally non-cancellable and non-refundable once production has started.</p>
        <p><span className="font-semibold text-foreground">10.</span> Customers are responsible for reviewing product descriptions, size charts, customization details, and delivery information carefully before placing orders.</p>
        <p><span className="font-semibold text-foreground">11.</span> Delivery timelines mentioned on the platform are estimated timelines only and may vary due to courier delays, weather conditions, operational issues, high-demand periods, or unforeseen circumstances beyond Antariya's control.</p>
        <p><span className="font-semibold text-foreground">12.</span> Antariya is not responsible for delays, losses, damages, or failed deliveries caused by incorrect customer information, unavailable recipients, courier partner issues, natural disasters, strikes, or force majeure events.</p>
        <p><span className="font-semibold text-foreground">13.</span> Return, refund, exchange, and cancellation requests will be governed strictly according to Antariya's official Return & Refund Policy and Cancellation Policy available on the platform.</p>
        <p><span className="font-semibold text-foreground">14.</span> Users must not misuse the platform by attempting unauthorized access, hacking, copying designs, spreading malware, manipulating transactions, posting harmful content, or disrupting website operations in any manner.</p>
        <p><span className="font-semibold text-foreground">15.</span> All logos, branding elements, embroidery concepts, product visuals, graphics, website content, designs, and creative assets associated with Antariya are intellectual property protected under applicable copyright and trademark laws.</p>
        <p><span className="font-semibold text-foreground">16.</span> Unauthorized reproduction, resale, duplication, commercial usage, modification, or distribution of Antariya content, products, branding, or creative assets without written permission is strictly prohibited.</p>
        <p><span className="font-semibold text-foreground">17.</span> Antariya reserves the right to monitor transactions, verify identities, request additional verification documents, and investigate suspicious activities to ensure platform safety and business protection.</p>
        <p><span className="font-semibold text-foreground">18.</span> Users engaging in fake return claims, fraudulent chargebacks, abusive communication, policy manipulation, harassment, or illegal activities may face account suspension, permanent restrictions, refund denial, or legal action.</p>
        <p><span className="font-semibold text-foreground">19.</span> Antariya shall not be held liable for indirect losses, emotional distress, business interruptions, third-party actions, technical failures, temporary website downtime, or damages arising from misuse of the platform or products.</p>
        <p><span className="font-semibold text-foreground">20.</span> Antariya reserves the right to update, modify, enforce, or revise these Terms & Conditions at any time without prior notice, and continued usage of the platform indicates acceptance of the updated terms.</p>
      </div>
    ),
  },
  {
    id: "shipping",
    title: "Shipping Policy",
    description: "Delivery timelines and shipping information",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya processes and ships orders across eligible serviceable locations within India.</p>
        <p><span className="font-semibold text-foreground">2.</span> All orders are processed only after successful payment confirmation through approved payment methods available on the platform.</p>
        <p><span className="font-semibold text-foreground">3.</span> Standard order processing time may vary between 2-5 business days depending on product availability, customization requirements, embroidery work, and order volume.</p>
        <p><span className="font-semibold text-foreground">4.</span> Customized, embroidery-based, made-to-order, or limited-edition products may require additional production and processing time before shipment.</p>
        <p><span className="font-semibold text-foreground">5.</span> Estimated delivery timelines displayed on the website are approximate and may vary based on customer location, courier availability, operational delays, weather conditions, or public holidays.</p>
        <p><span className="font-semibold text-foreground">6.</span> Antariya partners with trusted third-party logistics and courier services to ensure safe and timely delivery of products.</p>
        <p><span className="font-semibold text-foreground">7.</span> Shipping charges, if applicable, will be displayed during checkout before final payment confirmation.</p>
        <p><span className="font-semibold text-foreground">8.</span> Customers are responsible for providing accurate shipping details including full address, contact number, postal code, and recipient information during order placement.</p>
        <p><span className="font-semibold text-foreground">9.</span> Antariya will not be responsible for delays, failed deliveries, losses, or additional charges caused by incorrect or incomplete customer-provided shipping information.</p>
        <p><span className="font-semibold text-foreground">10.</span> Once an order is shipped, customers may receive tracking details through email, SMS, or other available communication methods.</p>
        <p><span className="font-semibold text-foreground">11.</span> Delivery timelines may be extended during festivals, sales, high-demand periods, natural disasters, strikes, transportation issues, government restrictions, or unforeseen operational disruptions.</p>
        <p><span className="font-semibold text-foreground">12.</span> Antariya reserves the right to delay, split, reschedule, or cancel shipments in situations involving stock unavailability, verification issues, suspicious transactions, or safety concerns.</p>
        <p><span className="font-semibold text-foreground">13.</span> Customers are advised to inspect packages carefully at the time of delivery and report any visible damage, tampering, missing items, or incorrect products immediately.</p>
        <p><span className="font-semibold text-foreground">14.</span> Antariya shall not be liable for damages caused after successful delivery confirmation provided by the courier partner or recipient.</p>
        <p><span className="font-semibold text-foreground">15.</span> In cases where delivery attempts fail due to customer unavailability, unreachable contact numbers, refusal to accept delivery, or incorrect addresses, re-shipping charges may apply.</p>
        <p><span className="font-semibold text-foreground">16.</span> Certain remote, restricted, or non-serviceable areas may experience additional delivery delays or shipping limitations based on courier partner availability.</p>
        <p><span className="font-semibold text-foreground">17.</span> Risk of product ownership and responsibility transfers to the customer upon successful delivery confirmation at the provided shipping address.</p>
        <p><span className="font-semibold text-foreground">18.</span> Antariya reserves the right to verify customer identity, shipping information, and transaction authenticity before dispatching high-value, suspicious, or bulk orders.</p>
        <p><span className="font-semibold text-foreground">19.</span> Shipping timelines provided by Antariya are estimates only and should not be considered guaranteed delivery commitments unless explicitly stated otherwise.</p>
        <p><span className="font-semibold text-foreground">20.</span> By placing an order with Antariya, customers acknowledge and accept all terms mentioned under this Shipping Policy.</p>
      </div>
    ),
  },
  {
    id: "returns",
    title: "Return & Refund Policy",
    description: "Guidelines for returns and refunds",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya aims to ensure customer satisfaction while maintaining fair business and operational protection standards.</p>
        <p><span className="font-semibold text-foreground">2.</span> Customers may request a return or refund only for eligible cases such as damaged products, wrong product delivery, defective items, or major manufacturing issues verified by Antariya.</p>
        <p><span className="font-semibold text-foreground">3.</span> Return requests must be raised within 3 days from the date of successful delivery of the product.</p>
        <p><span className="font-semibold text-foreground">4.</span> Products requested for return must remain unused, unwashed, unaltered, and in their original condition along with original packaging, tags, invoices, and accessories.</p>
        <p><span className="font-semibold text-foreground">5.</span> Customized, personalized, embroidery-made, made-to-order, limited-edition, discounted, clearance-sale, or special collaboration products are generally non-returnable and non-refundable unless damaged or incorrect upon delivery.</p>
        <p><span className="font-semibold text-foreground">6.</span> Minor color differences, thread variations, fabric texture differences, or slight embroidery irregularities caused by lighting, screen settings, or handcrafted processes shall not be considered defects eligible for refunds.</p>
        <p><span className="font-semibold text-foreground">7.</span> Customers must provide clear unboxing videos, product images, and supporting proof while reporting damaged, defective, missing, or incorrect products for claim verification purposes.</p>
        <p><span className="font-semibold text-foreground">8.</span> Antariya reserves the right to reject return or refund requests if adequate proof is not provided or if the claim appears false, manipulated, abusive, or fraudulent.</p>
        <p><span className="font-semibold text-foreground">9.</span> Refunds will only be initiated after returned products are inspected, verified, and approved by the Antariya quality verification team.</p>
        <p><span className="font-semibold text-foreground">10.</span> Refund processing timelines may vary between 5-7 business days after successful approval of the return request.</p>
        <p><span className="font-semibold text-foreground">11.</span> Refunds will be credited only to the original payment method used during the transaction unless otherwise decided by Antariya under exceptional circumstances.</p>
        <p><span className="font-semibold text-foreground">12.</span> Shipping charges, platform fees, convenience fees, or other non-product service charges may not be refundable unless the error was caused directly by Antariya.</p>
        <p><span className="font-semibold text-foreground">13.</span> Antariya reserves the right to provide replacements, exchanges, store credits, partial refunds, or alternative resolutions depending on product condition, stock availability, and case evaluation.</p>
        <p><span className="font-semibold text-foreground">14.</span> Products damaged due to customer misuse, improper handling, unauthorized alterations, washing negligence, external accidents, or intentional damage shall not qualify for returns or refunds.</p>
        <p><span className="font-semibold text-foreground">15.</span> Customers engaging in fake return claims, used-product returns, refund abuse, chargeback fraud, or policy manipulation may face permanent account restrictions and legal action if necessary.</p>
        <p><span className="font-semibold text-foreground">16.</span> In cases where return pickup services are unavailable, customers may be required to self-ship eligible products to the address provided by Antariya.</p>
        <p><span className="font-semibold text-foreground">17.</span> Antariya is not responsible for returned packages lost, damaged, or delayed during customer-initiated return shipping processes without approved tracking confirmation.</p>
        <p><span className="font-semibold text-foreground">18.</span> Exchange requests are subject to stock availability and may require additional verification depending on the nature of the request.</p>
        <p><span className="font-semibold text-foreground">19.</span> Antariya reserves the complete right to approve, deny, investigate, or hold any return, exchange, or refund request to protect customers, operations, and business security.</p>
        <p><span className="font-semibold text-foreground">20.</span> By placing an order with Antariya, customers acknowledge and agree to comply with all conditions mentioned in this Return & Refund Policy.</p>
      </div>
    ),
  },
  {
    id: "cancellation",
    title: "Cancellation Policy",
    description: "Order cancellation guidelines",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya allows order cancellations only under eligible conditions mentioned in this Cancellation Policy.</p>
        <p><span className="font-semibold text-foreground">2.</span> Customers may request cancellation of an order only before the product enters production, customization, embroidery processing, packaging, or shipment stages.</p>
        <p><span className="font-semibold text-foreground">3.</span> Once an order has been shipped, dispatched, or handed over to the courier partner, cancellation requests will not be accepted.</p>
        <p><span className="font-semibold text-foreground">4.</span> Customized, personalized, embroidery-made, made-to-order, limited-edition, or pre-order products are generally non-cancellable once production or processing has started.</p>
        <p><span className="font-semibold text-foreground">5.</span> Cancellation requests must be submitted through official Antariya communication channels along with valid order details and customer verification information.</p>
        <p><span className="font-semibold text-foreground">6.</span> Antariya reserves the right to verify customer identity and transaction details before approving any cancellation request.</p>
        <p><span className="font-semibold text-foreground">7.</span> Refunds for approved cancellations will be processed to the original payment method used during checkout unless otherwise decided by Antariya.</p>
        <p><span className="font-semibold text-foreground">8.</span> Cancellation refund timelines may vary depending on payment gateway processing time, banking systems, and transaction verification procedures.</p>
        <p><span className="font-semibold text-foreground">9.</span> Shipping charges, payment gateway fees, convenience fees, taxes, or other service charges may be non-refundable in certain cancellation cases.</p>
        <p><span className="font-semibold text-foreground">10.</span> Antariya reserves the right to deny cancellation requests if production work, embroidery processing, packaging, or shipment preparation has already begun.</p>
        <p><span className="font-semibold text-foreground">11.</span> Orders placed during sales, limited drops, exclusive launches, clearance campaigns, or promotional events may be subject to stricter cancellation restrictions.</p>
        <p><span className="font-semibold text-foreground">12.</span> Antariya may cancel orders without prior notice in situations involving payment failures, duplicate orders, pricing errors, stock unavailability, suspicious activities, or policy violations.</p>
        <p><span className="font-semibold text-foreground">13.</span> Customers providing false information, fake addresses, invalid contact details, or suspicious payment activities may have their orders automatically canceled for security reasons.</p>
        <p><span className="font-semibold text-foreground">14.</span> Antariya reserves the right to temporarily hold, investigate, or delay orders flagged by fraud detection systems or internal verification checks.</p>
        <p><span className="font-semibold text-foreground">15.</span> Repeated cancellation abuse, fake ordering behavior, refusal-to-accept-delivery patterns, or misuse of platform policies may result in account suspension or permanent restrictions.</p>
        <p><span className="font-semibold text-foreground">16.</span> Antariya shall not be liable for indirect losses, emotional claims, missed opportunities, or third-party expenses arising from order cancellation decisions.</p>
        <p><span className="font-semibold text-foreground">17.</span> If a cancellation request is rejected after shipment or production has started, customers may still refer to eligible conditions under the Return & Refund Policy after delivery.</p>
        <p><span className="font-semibold text-foreground">18.</span> Antariya reserves the right to recover operational losses, shipping costs, packaging expenses, or production costs in cases involving abusive cancellation behavior or intentional misuse.</p>
        <p><span className="font-semibold text-foreground">19.</span> Customers are advised to carefully review product details, customization information, sizing, pricing, and delivery timelines before confirming orders.</p>
        <p><span className="font-semibold text-foreground">20.</span> By placing an order on Antariya, customers acknowledge and agree to all terms mentioned under this Cancellation Policy.</p>
      </div>
    ),
  },
  {
    id: "exchange",
    title: "Exchange Policy",
    description: "Product exchange guidelines",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya provides exchange options only for eligible products and approved situations mentioned under this Exchange Policy.</p>
        <p><span className="font-semibold text-foreground">2.</span> Customers may request an exchange in cases involving wrong product delivery, size issues, damaged products, defective items, or verified manufacturing defects.</p>
        <p><span className="font-semibold text-foreground">3.</span> Exchange requests must be raised within 3 days from the date of successful product delivery.</p>
        <p><span className="font-semibold text-foreground">4.</span> Products eligible for exchange must remain unused, unwashed, unaltered, and in original condition with tags, packaging, invoice, and accessories intact.</p>
        <p><span className="font-semibold text-foreground">5.</span> Customized, personalized, embroidery-made, limited-edition, made-to-order, clearance-sale, or discounted products are generally non-exchangeable unless the issue was caused directly by Antariya.</p>
        <p><span className="font-semibold text-foreground">6.</span> Customers must provide clear product images, unboxing videos, invoices, and supporting proof while submitting exchange requests for verification purposes.</p>
        <p><span className="font-semibold text-foreground">7.</span> Minor variations in thread work, embroidery texture, color tone, fabric finish, or handcrafted detailing shall not be treated as defects eligible for exchange.</p>
        <p><span className="font-semibold text-foreground">8.</span> Exchange approval is subject to product inspection, stock availability, verification checks, and internal quality assessment by Antariya.</p>
        <p><span className="font-semibold text-foreground">9.</span> If the requested exchange product is unavailable, Antariya may provide store credit, replacement alternatives, partial refunds, or other suitable resolutions.</p>
        <p><span className="font-semibold text-foreground">10.</span> Customers are responsible for selecting correct sizes, customization details, colors, and product variants before placing orders.</p>
        <p><span className="font-semibold text-foreground">11.</span> Antariya reserves the right to reject exchange requests involving used products, damaged products caused by customer misuse, incomplete packaging, or suspicious claims.</p>
        <p><span className="font-semibold text-foreground">12.</span> Shipping charges, reverse pickup fees, or reshipping costs may apply in certain exchange cases depending on the reason for exchange.</p>
        <p><span className="font-semibold text-foreground">13.</span> Exchange pickups and deliveries are subject to service availability in the customer’s location and courier partner support.</p>
        <p><span className="font-semibold text-foreground">14.</span> Customers engaging in fake exchange claims, repeated policy abuse, manipulated damage reports, or fraudulent behavior may face account restrictions or permanent suspension.</p>
        <p><span className="font-semibold text-foreground">15.</span> Antariya shall not be responsible for delays in exchange processing caused by courier issues, weather conditions, public holidays, stock delays, or unforeseen operational circumstances.</p>
        <p><span className="font-semibold text-foreground">16.</span> Products returned without prior approval or official exchange confirmation from Antariya may not be accepted or processed.</p>
        <p><span className="font-semibold text-foreground">17.</span> In cases where reverse pickup is unavailable, customers may be instructed to self-ship products to the officially provided return address.</p>
        <p><span className="font-semibold text-foreground">18.</span> Antariya reserves the right to conduct verification checks before approving exchanges for high-value, suspicious, or bulk orders.</p>
        <p><span className="font-semibold text-foreground">19.</span> Exchange timelines may vary depending on product availability, verification process, logistics operations, and production schedules.</p>
        <p><span className="font-semibold text-foreground">20.</span> By placing an order with Antariya, customers acknowledge and agree to comply with all terms mentioned under this Exchange Policy.</p>
      </div>
    ),
  },
  {
    id: "disclaimer",
    title: "Disclaimer Policy",
    description: "Legal disclaimers and limitations",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya operates as an independent embroidery-focused fashion and merchandise brand.</p>
        <p><span className="font-semibold text-foreground">2.</span> Any fan-inspired, cinema-inspired, celebrity-inspired, anime-inspired, sports-inspired, cultural-inspired, or artistic merchandise created by Antariya is intended solely for creative and artistic expression purposes.</p>
        <p><span className="font-semibold text-foreground">3.</span> Antariya does not claim official association, sponsorship, endorsement, partnership, or authorization from any celebrity, movie production house, anime studio, sports organization, music label, franchise, or trademark owner unless explicitly mentioned.</p>
        <p><span className="font-semibold text-foreground">4.</span> All third-party trademarks, logos, brand names, movie titles, character names, celebrity references, and copyrights belong to their respective owners.</p>
        <p><span className="font-semibold text-foreground">5.</span> Product images, embroidery previews, mockups, digital designs, and promotional visuals displayed on the platform are for representation purposes only and may slightly vary in actual appearance.</p>
        <p><span className="font-semibold text-foreground">6.</span> Minor differences in embroidery texture, stitching style, color shades, print positioning, thread detailing, or fabric finishing are natural outcomes of production and handcrafted processes.</p>
        <p><span className="font-semibold text-foreground">7.</span> Antariya makes reasonable efforts to maintain accurate product information, pricing, descriptions, availability, and visuals but does not guarantee complete accuracy at all times.</p>
        <p><span className="font-semibold text-foreground">8.</span> Antariya reserves the right to modify, discontinue, remove, replace, or update products, services, pricing, content, or website features without prior notice.</p>
        <p><span className="font-semibold text-foreground">9.</span> Customers are responsible for reviewing product specifications, sizing charts, customization details, and delivery timelines before placing orders.</p>
        <p><span className="font-semibold text-foreground">10.</span> Antariya shall not be held liable for allergic reactions, skin sensitivities, improper usage damages, or product misuse caused after delivery.</p>
        <p><span className="font-semibold text-foreground">11.</span> The platform may contain external links, social media integrations, or third-party services, and Antariya is not responsible for the content, privacy practices, or security of such external platforms.</p>
        <p><span className="font-semibold text-foreground">12.</span> Antariya shall not be responsible for delays, losses, interruptions, or damages caused by courier partners, technical failures, internet issues, force majeure events, or circumstances beyond operational control.</p>
        <p><span className="font-semibold text-foreground">13.</span> Users are responsible for maintaining the confidentiality of their account credentials, passwords, OTPs, and personal login information.</p>
        <p><span className="font-semibold text-foreground">14.</span> Unauthorized copying, reproduction, resale, commercial usage, or distribution of Antariya’s branding, embroidery concepts, product visuals, website content, or creative assets is strictly prohibited.</p>
        <p><span className="font-semibold text-foreground">15.</span> Antariya reserves the right to suspend accounts, refuse services, cancel orders, or initiate legal action against activities involving fraud, abuse, policy manipulation, hacking attempts, or intellectual property violations.</p>
        <p><span className="font-semibold text-foreground">16.</span> Information provided on the platform including blogs, captions, promotional material, and social media content is intended for informational, branding, and marketing purposes only.</p>
        <p><span className="font-semibold text-foreground">17.</span> Antariya does not guarantee uninterrupted website availability, error-free functionality, or complete immunity from technical issues, malware, or cyber threats despite maintaining security practices.</p>
        <p><span className="font-semibold text-foreground">18.</span> Customers acknowledge that purchasing customized or made-to-order products involves production timelines and possible minor artistic variations unique to embroidery craftsmanship.</p>
        <p><span className="font-semibold text-foreground">19.</span> Continued use of the Antariya platform indicates acceptance of all applicable policies, disclaimers, operational guidelines, and future policy updates.</p>
        <p><span className="font-semibold text-foreground">20.</span> Antariya reserves the complete right to revise, modify, enforce, or update this Disclaimer Policy at any time without prior notice.</p>
      </div>
    ),
  },
  {
    id: "cookies",
    title: "Cookie Policy",
    description: "How we use cookies and tracking technologies",
    content: (
      <div className="space-y-3">
        <p>Antariya uses cookies and similar tracking technologies to improve website performance, security, and user experience.</p>
        <p>By accessing or using the Antariya website, users consent to the use of cookies in accordance with this Cookie Policy.</p>
        <p>Cookies are small text files stored on a user’s device that help the website recognize users, remember preferences, and enhance functionality.</p>
        <p>Antariya may use cookies to maintain secure login sessions, shopping cart information, account preferences, and browsing continuity.</p>
        <p>Cookies may also be used to analyze website traffic, user interactions, browsing behavior, and product engagement for operational and analytical purposes.</p>
        <p>Certain cookies help improve website speed, loading performance, content personalization, and user navigation experience across the platform.</p>
        <p>Antariya may use security-related cookies to detect suspicious activities, prevent fraud, identify unauthorized access attempts, and maintain platform protection.</p>
        <p>Third-party services integrated with Antariya, including payment gateways, analytics providers, social media tools, and advertising partners, may also place cookies on user devices.</p>
        <p>Antariya does not use cookies to directly store sensitive information such as passwords, debit card details, credit card numbers, OTPs, or banking credentials.</p>
        <p>Some cookies are temporary session cookies that automatically expire when the browser is closed, while others may remain stored for future visits and personalization.</p>
        <p>Users may choose to disable, restrict, or delete cookies through their browser settings at any time according to their personal privacy preferences.</p>
        <p>Disabling certain cookies may affect website functionality, account access, shopping cart operations, personalized recommendations, or overall browsing experience.</p>
        <p>Antariya may use analytics tools and tracking technologies to understand customer interests, improve products, optimize website performance, and enhance marketing effectiveness.</p>
        <p>Cookies may be used during promotional campaigns, advertisements, limited drops, or special launches to improve user engagement and website stability.</p>
        <p>Antariya does not sell, misuse, or intentionally share cookie-generated personal browsing data with unauthorized third parties for unlawful commercial purposes.</p>
        <p>Information collected through cookies may be combined with account information, order history, or browsing data to improve customer experience and operational efficiency.</p>
        <p>Users are responsible for managing their browser privacy settings, cookie permissions, and device security preferences according to their requirements.</p>
        <p>Antariya reserves the right to modify, update, add, or remove cookie technologies and tracking mechanisms as part of website improvements or security enhancements.</p>
        <p>Continued use of the Antariya website after cookie notifications or policy updates shall be considered as acceptance of this Cookie Policy.</p>
        <p>Antariya reserves the complete right to revise or update this Cookie Policy at any time without prior notice to maintain legal compliance, platform security, and operational improvements.</p>
      </div>
    ),
  },
  {
    id: "payment",
    title: "Payment Policy",
    description: "Payment methods and security",
    content: (
      <div className="space-y-3">
        <p>Antariya accepts payments only through officially approved payment methods available on the platform.</p>
        <p>Customers are responsible for providing accurate payment details, billing information, and authorized transaction credentials while placing orders.</p>
        <p>All payments made on Antariya are processed through trusted and secure third-party payment gateways following industry-standard encryption and security protocols.</p>
        <p>Antariya does not directly store sensitive payment information including full debit card numbers, credit card numbers, CVV details, UPI PINs, OTPs, or internet banking passwords.</p>
        <p>Orders will be confirmed and processed only after successful payment authorization and verification from the payment gateway or banking institution.</p>
        <p>Antariya reserves the right to cancel, reject, delay, or hold any order involving payment failures, suspicious transactions, duplicate payments, unauthorized usage, or verification concerns.</p>
        <p>Customers must ensure sufficient account balance, valid payment credentials, and proper transaction authorization before completing payments on the platform.</p>
        <p>In cases of failed transactions where payment is deducted but the order is not confirmed, customers are advised to wait for banking reconciliation timelines before raising disputes.</p>
        <p>Refund timelines for failed or canceled transactions may vary depending on banks, payment gateways, UPI systems, card providers, or financial institutions involved.</p>
        <p>Antariya shall not be responsible for payment failures, delays, server issues, transaction interruptions, or banking errors originating from third-party payment providers or customer-side technical issues.</p>
        <p>Any attempt to use stolen cards, unauthorized payment methods, fake payment screenshots, fraudulent transactions, or illegal financial activities may result in account suspension and legal action.</p>
        <p>Antariya reserves the right to request additional identity verification, billing proof, or transaction confirmation for high-value, suspicious, or bulk orders.</p>
        <p>Pricing displayed on the platform is shown in Indian Rupees (INR) and may change without prior notice due to operational, promotional, taxation, or market-related reasons.</p>
        <p>Taxes, shipping charges, convenience fees, platform charges, or additional applicable costs will be clearly displayed during checkout before payment confirmation.</p>
        <p>Customers are responsible for reviewing payment details, order summaries, quantities, pricing, and applicable charges carefully before completing transactions.</p>
        <p>In cases involving duplicate payments or technical transaction errors verified by Antariya, eligible refunds will be initiated through the original payment method wherever possible.</p>
        <p>Antariya reserves the right to restrict payment methods or limit transaction access for specific locations, products, users, or risk-based situations.</p>
        <p>Customers must not misuse promotional coupons, discount codes, referral systems, cashback offers, or payment-related campaigns in fraudulent or manipulative ways.</p>
        <p>Antariya may temporarily hold order processing during payment verification, fraud checks, security reviews, or transaction authenticity investigations for platform protection.</p>
        <p>By making payments on Antariya, customers acknowledge and agree to comply with all terms mentioned under this Payment Policy.</p>
      </div>
    ),
  },
  {
    id: "ip",
    title: "Intellectual Property & Copyright Policy",
    description: "Protection of intellectual property rights",
    content: (
      <div className="space-y-3">
        <p>Antariya owns and protects its brand identity, embroidery concepts, creative assets, website content, and original merchandise designs under applicable intellectual property and copyright laws.</p>
        <p>All logos, brand names, graphics, embroidery artworks, product visuals, website layouts, captions, promotional materials, videos, photographs, mockups, and creative content associated with Antariya are the exclusive property of Antariya unless otherwise stated.</p>
        <p>Unauthorized copying, reproduction, modification, resale, redistribution, republication, or commercial use of Antariya content without written permission is strictly prohibited.</p>
        <p>Customers, visitors, creators, resellers, and third parties may not use Antariya branding, logos, embroidery concepts, or product visuals in a misleading, unauthorized, defamatory, or commercially exploitative manner.</p>
        <p>Any embroidery patterns, illustrations, artwork placements, custom designs, typography arrangements, and visual compositions created by Antariya are protected as original creative works.</p>
        <p>Users are prohibited from duplicating or manufacturing counterfeit versions of Antariya products, designs, packaging, branding, or merchandise for commercial or non-commercial purposes.</p>
        <p>Antariya reserves the right to take legal action, issue copyright claims, remove infringing content, suspend accounts, or initiate enforcement measures against intellectual property violations.</p>
        <p>Fan-inspired, cinema-inspired, anime-inspired, celebrity-inspired, cultural-inspired, or artistic merchandise created by Antariya is intended as transformative artistic expression and does not claim official ownership of third-party intellectual properties unless explicitly stated.</p>
        <p>All third-party trademarks, movie titles, celebrity names, character names, logos, franchises, and copyrighted materials referenced on Antariya belong to their respective owners.</p>
        <p>Antariya does not permit unauthorized sellers, resellers, manufacturers, marketplaces, pages, or websites to reproduce or distribute its products without official approval.</p>
        <p>Customers purchasing products from Antariya receive ownership only of the physical product and do not receive ownership rights to underlying artwork, branding, embroidery concepts, or intellectual property.</p>
        <p>Users may not remove, alter, hide, or manipulate any copyright notices, watermarks, logos, branding identifiers, or proprietary markings present on Antariya products or content.</p>
        <p>Screenshots, product images, videos, and website content from Antariya may not be reused for advertisements, resale listings, fake promotions, or misleading commercial activities without authorization.</p>
        <p>Antariya reserves the right to monitor digital platforms, marketplaces, websites, and social media channels for unauthorized usage or infringement of its intellectual property.</p>
        <p>Any custom designs, ideas, artwork, or creative submissions voluntarily shared with Antariya for production purposes may be used solely for operational and manufacturing requirements unless otherwise agreed.</p>
        <p>Customers submitting copyrighted materials, logos, celebrity artwork, or third-party content for customization confirm that they possess the necessary rights or permissions for such usage.</p>
        <p>Antariya shall not be held liable for customer-submitted content that violates third-party copyrights, trademarks, publicity rights, or intellectual property laws.</p>
        <p>Any unauthorized attempt to exploit, reverse-engineer, scrape, clone, imitate, or replicate Antariya’s business identity, platform structure, creative assets, or digital content may result in legal enforcement actions.</p>
        <p>Intellectual property complaints, copyright concerns, trademark disputes, or infringement reports may be submitted to Antariya through official communication channels with proper supporting evidence.</p>
        <p>Antariya reserves the complete right to update, enforce, modify, or expand this Intellectual Property & Copyright Policy at any time without prior notice for legal protection and brand security purposes.</p>
      </div>
    ),
  },
  {
    id: "conduct",
    title: "User Conduct Policy",
    description: "Acceptable behavior on the platform",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> By accessing or using Antariya, users agree to behave responsibly, lawfully, and respectfully while interacting with the platform, products, services, and community.</p>
        <p><span className="font-semibold text-foreground">2.</span> Users must provide accurate, genuine, and complete information during account creation, order placement, payment processing, and customer communication.</p>
        <p><span className="font-semibold text-foreground">3.</span> Any use of fake identities, false information, impersonation, misleading details, or unauthorized accounts is strictly prohibited on the Antariya platform.</p>
        <p><span className="font-semibold text-foreground">4.</span> Users must not attempt to gain unauthorized access to Antariya systems, databases, servers, accounts, administrative tools, or restricted website areas.</p>
        <p><span className="font-semibold text-foreground">5.</span> Activities including hacking, phishing, malware distribution, spamming, scraping, reverse engineering, automated attacks, or interference with website operations are strictly prohibited.</p>
        <p><span className="font-semibold text-foreground">6.</span> Users must not misuse the platform for illegal, fraudulent, abusive, harmful, defamatory, threatening, discriminatory, or unethical activities.</p>
        <p><span className="font-semibold text-foreground">7.</span> Customers are prohibited from placing fake orders, intentionally refusing deliveries, manipulating refunds, or exploiting promotional campaigns unfairly.</p>
        <p><span className="font-semibold text-foreground">8.</span> Any attempt to use stolen payment methods, unauthorized transactions, fake payment screenshots, chargeback fraud, or financial manipulation may result in immediate account suspension and legal action.</p>
        <p><span className="font-semibold text-foreground">9.</span> Users must not upload, share, distribute, or communicate content containing hate speech, harassment, explicit material, violence, illegal material, malware, or harmful information through Antariya platforms.</p>
        <p><span className="font-semibold text-foreground">10.</span> Customers are expected to communicate respectfully with Antariya staff, support teams, delivery personnel, collaborators, and community members during all interactions.</p>
        <p><span className="font-semibold text-foreground">11.</span> Abusive language, threats, intimidation, harassment, defamation, blackmail, or offensive behavior directed toward Antariya representatives or users will not be tolerated.</p>
        <p><span className="font-semibold text-foreground">12.</span> Users must not copy, reproduce, steal, resell, distribute, or misuse Antariya logos, embroidery concepts, branding, website content, product visuals, or creative assets without written permission.</p>
        <p><span className="font-semibold text-foreground">13.</span> Customers are responsible for maintaining the confidentiality of their account credentials, passwords, OTPs, and login details associated with Antariya services.</p>
        <p><span className="font-semibold text-foreground">14.</span> Users must not exploit bugs, technical vulnerabilities, system loopholes, pricing errors, or operational weaknesses for personal gain or unfair advantage.</p>
        <p><span className="font-semibold text-foreground">15.</span> Any suspicious activity, fraud attempt, policy abuse, or violation of platform rules may result in order cancellation, refund denial, account restriction, or permanent suspension.</p>
        <p><span className="font-semibold text-foreground">16.</span> Antariya reserves the right to monitor user activity, transaction behavior, website interactions, and communication records to maintain platform safety and operational security.</p>
        <p><span className="font-semibold text-foreground">17.</span> Users engaging in repeated policy violations, disruptive behavior, fraudulent activities, intellectual property infringement, or harmful conduct may face legal action under applicable laws.</p>
        <p><span className="font-semibold text-foreground">18.</span> Antariya reserves the right to remove accounts, restrict services, block access, or report activities to authorities whenever necessary to protect customers, business operations, and platform integrity.</p>
        <p><span className="font-semibold text-foreground">19.</span> Customers are responsible for complying with all applicable local, state, national, and international laws while using Antariya services and products.</p>
        <p><span className="font-semibold text-foreground">20.</span> By continuing to access or use the Antariya platform, users acknowledge and agree to comply fully with this User Conduct Policy and all related platform policies.</p>
      </div>
    ),
  },
  {
    id: "dataProtection",
    title: "Data Protection Policy",
    description: "How we protect and manage your data",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya is committed to protecting customer, business, operational, and platform data through responsible security and privacy practices.</p>
        <p><span className="font-semibold text-foreground">2.</span> Antariya collects, stores, and processes user information only for lawful business purposes including order processing, customer support, payment verification, logistics, fraud prevention, and service improvement.</p>
        <p><span className="font-semibold text-foreground">3.</span> Personal information collected by Antariya may include customer names, contact details, shipping addresses, billing information, order history, and account-related data.</p>
        <p><span className="font-semibold text-foreground">4.</span> Sensitive payment information such as complete debit card numbers, credit card numbers, CVV details, UPI PINs, OTPs, and banking passwords are not directly stored by Antariya.</p>
        <p><span className="font-semibold text-foreground">5.</span> All customer data is protected using reasonable administrative, technical, and organizational safeguards designed to reduce unauthorized access, misuse, loss, alteration, or disclosure.</p>
        <p><span className="font-semibold text-foreground">6.</span> Antariya may use encrypted systems, secure servers, restricted access controls, authentication mechanisms, monitoring systems, and security protocols to strengthen data protection measures.</p>
        <p><span className="font-semibold text-foreground">7.</span> Access to customer information is limited only to authorized personnel, operational teams, logistics partners, payment providers, or technical service providers who require such access for legitimate business functions.</p>
        <p><span className="font-semibold text-foreground">8.</span> Antariya does not sell, lease, trade, or intentionally disclose customer personal information to unauthorized third parties for commercial exploitation.</p>
        <p><span className="font-semibold text-foreground">9.</span> Customer data may be shared with government authorities, law enforcement agencies, legal representatives, or regulatory bodies only when required by applicable laws or legal obligations.</p>
        <p><span className="font-semibold text-foreground">10.</span> Antariya may monitor platform activity, login attempts, transaction behavior, and system interactions to detect fraud, suspicious activities, unauthorized access, or cybersecurity threats.</p>
        <p><span className="font-semibold text-foreground">11.</span> Customers are responsible for maintaining the confidentiality of their account credentials, passwords, OTPs, devices, and login information associated with Antariya accounts.</p>
        <p><span className="font-semibold text-foreground">12.</span> Users must immediately report unauthorized account access, suspicious activities, data misuse, or security concerns to Antariya through official communication channels.</p>
        <p><span className="font-semibold text-foreground">13.</span> Antariya regularly works to improve platform security, operational reliability, and protection systems against malware, cyberattacks, unauthorized access attempts, and digital threats.</p>
        <p><span className="font-semibold text-foreground">14.</span> Despite implementing security measures, Antariya cannot guarantee absolute protection against all cyber risks, internet vulnerabilities, technical failures, or sophisticated security breaches.</p>
        <p><span className="font-semibold text-foreground">15.</span> Customer data may be retained for operational, legal, accounting, taxation, fraud prevention, dispute resolution, and compliance-related purposes as required by applicable regulations.</p>
        <p><span className="font-semibold text-foreground">16.</span> Users may request access, correction, modification, or deletion of eligible personal data subject to legal, operational, verification, and security requirements.</p>
        <p><span className="font-semibold text-foreground">17.</span> Third-party services integrated with Antariya including payment gateways, courier systems, analytics providers, or external platforms may maintain independent data protection and privacy practices.</p>
        <p><span className="font-semibold text-foreground">18.</span> Antariya shall not be held responsible for security breaches, privacy failures, or unauthorized disclosures occurring on third-party platforms beyond its direct operational control.</p>
        <p><span className="font-semibold text-foreground">19.</span> Any attempt to misuse, steal, manipulate, exploit, hack, scrape, or gain unauthorized access to Antariya data, systems, servers, or customer information may result in immediate legal and enforcement actions.</p>
        <p><span className="font-semibold text-foreground">20.</span> Antariya reserves the complete right to update, revise, strengthen, or modify this Data Protection Policy at any time to maintain legal compliance, cybersecurity standards, operational security, and customer protection.</p>
      </div>
    ),
  },
  {
    id: "preorder",
    title: "Pre-order Policy",
    description: "Guidelines for pre-order and limited drops",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya may offer selected products on a pre-order basis before official production completion, stock availability, or public release.</p>
        <p><span className="font-semibold text-foreground">2.</span> Pre-order products may include limited-edition merchandise, embroidery-based collections, customized apparel, collaboration drops, exclusive launches, or high-demand releases.</p>
        <p><span className="font-semibold text-foreground">3.</span> By placing a pre-order, customers acknowledge and agree that the purchased product is not immediately available for dispatch and may require additional production or processing time.</p>
        <p><span className="font-semibold text-foreground">4.</span> Estimated production timelines, dispatch schedules, and delivery windows for pre-order products will be communicated on the product page or during checkout whenever possible.</p>
        <p><span className="font-semibold text-foreground">5.</span> Pre-order timelines are approximate estimates only and may vary due to embroidery processing, manufacturing delays, raw material availability, operational issues, logistics disruptions, or unforeseen circumstances.</p>
        <p><span className="font-semibold text-foreground">6.</span> Full or partial payment may be required at the time of placing a pre-order depending on the product, campaign, or launch conditions determined by Antariya.</p>
        <p><span className="font-semibold text-foreground">7.</span> Orders for pre-order products will be processed according to production schedules, order sequence, stock allocation, and operational availability.</p>
        <p><span className="font-semibold text-foreground">8.</span> Antariya reserves the right to limit pre-order quantities per customer, account, address, or transaction to prevent abuse, reselling manipulation, or unfair purchasing activities.</p>
        <p><span className="font-semibold text-foreground">9.</span> Customers are responsible for carefully reviewing product descriptions, expected timelines, sizing details, customization information, and pre-order conditions before confirming purchases.</p>
        <p><span className="font-semibold text-foreground">10.</span> Minor variations in embroidery texture, thread detailing, color tones, handcrafted finishing, packaging, or final appearance may occur between promotional previews and final delivered products.</p>
        <p><span className="font-semibold text-foreground">11.</span> Pre-order products are generally non-cancellable and non-refundable once production, customization, embroidery work, or manufacturing has started.</p>
        <p><span className="font-semibold text-foreground">12.</span> Antariya reserves the right to delay, modify, suspend, or cancel pre-order production in situations involving supplier issues, operational disruptions, technical failures, legal concerns, safety risks, or force majeure events.</p>
        <p><span className="font-semibold text-foreground">13.</span> In cases where Antariya cancels a pre-order due to operational inability or stock unavailability, eligible refunds will be processed according to applicable refund timelines.</p>
        <p><span className="font-semibold text-foreground">14.</span> Customers engaging in fake bookings, payment fraud, chargeback abuse, bulk-order manipulation, or policy misuse may have their pre-orders canceled without notice.</p>
        <p><span className="font-semibold text-foreground">15.</span> Antariya may conduct payment verification, identity verification, address validation, or fraud checks before confirming high-value or suspicious pre-order transactions.</p>
        <p><span className="font-semibold text-foreground">16.</span> Shipping timelines for pre-order products begin only after production completion and dispatch confirmation, not from the date of order placement.</p>
        <p><span className="font-semibold text-foreground">17.</span> Antariya shall not be liable for indirect losses, missed expectations, emotional claims, business interruptions, or third-party damages caused by production or delivery delays related to pre-orders.</p>
        <p><span className="font-semibold text-foreground">18.</span> Customers will be notified through available communication channels regarding major updates, dispatch status, production progress, delays, or important changes affecting pre-order products whenever reasonably possible.</p>
        <p><span className="font-semibold text-foreground">19.</span> Antariya reserves the right to refuse, restrict, or cancel pre-orders that violate platform policies, operational limits, intellectual property standards, or legal requirements.</p>
        <p><span className="font-semibold text-foreground">20.</span> By placing a pre-order with Antariya, customers acknowledge and agree to comply fully with all terms mentioned under this Pre-order Policy.</p>
      </div>
    ),
  },
  {
    id: "customization",
    title: "Customization Policy",
    description: "Guidelines for custom and embroidery products",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya offers customization services for selected products including embroidery work, personalized designs, names, artwork, text, and limited-edition merchandise.</p>
        <p><span className="font-semibold text-foreground">2.</span> Customers are responsible for providing accurate customization details including names, spellings, artwork, color preferences, sizing, placement instructions, and design requirements before confirming orders.</p>
        <p><span className="font-semibold text-foreground">3.</span> Once a customization order is confirmed and production has started, modifications, cancellations, or changes may not be possible.</p>
        <p><span className="font-semibold text-foreground">4.</span> Customized and personalized products are specially created according to customer specifications and are generally non-returnable, non-refundable, and non-exchangeable unless the issue is caused directly by Antariya.</p>
        <p><span className="font-semibold text-foreground">5.</span> Customers must carefully review all entered customization details before placing orders, as Antariya shall not be responsible for errors caused by incorrect customer-provided information.</p>
        <p><span className="font-semibold text-foreground">6.</span> Antariya reserves the right to reject customization requests containing offensive language, hate speech, illegal content, explicit material, harmful messages, discriminatory elements, or policy-violating content.</p>
        <p><span className="font-semibold text-foreground">7.</span> Customers submitting logos, artwork, celebrity references, brand elements, or copyrighted materials for customization confirm that they possess the necessary legal rights or permissions for such usage.</p>
        <p><span className="font-semibold text-foreground">8.</span> Antariya shall not be liable for copyright, trademark, publicity rights, or intellectual property disputes arising from customer-submitted customization content.</p>
        <p><span className="font-semibold text-foreground">9.</span> Embroidery-based customization involves handcrafted production processes, and minor variations in stitching, alignment, thread detailing, texture, or color tones may naturally occur.</p>
        <p><span className="font-semibold text-foreground">10.</span> Product previews, mockups, digital renders, or sample images shown before production are approximate visual representations and may differ slightly from the final physical product.</p>
        <p><span className="font-semibold text-foreground">11.</span> Customization timelines may vary depending on design complexity, embroidery workload, production schedules, material availability, and operational conditions.</p>
        <p><span className="font-semibold text-foreground">12.</span> Antariya reserves the right to delay, refuse, suspend, or cancel customization orders if technical limitations, production issues, safety concerns, policy violations, or operational risks arise.</p>
        <p><span className="font-semibold text-foreground">13.</span> Customers are responsible for ensuring that uploaded files, images, logos, or artwork meet quality standards suitable for embroidery or printing production.</p>
        <p><span className="font-semibold text-foreground">14.</span> Antariya may adjust embroidery placement, thread density, sizing proportions, stitching techniques, or production methods when necessary to maintain product quality and manufacturing feasibility.</p>
        <p><span className="font-semibold text-foreground">15.</span> Customized products may require additional verification, approval, or communication before production begins depending on design complexity or content review.</p>
        <p><span className="font-semibold text-foreground">16.</span> Antariya reserves the right to decline customization requests that may damage brand reputation, violate laws, create operational risks, or conflict with company values and platform guidelines.</p>
        <p><span className="font-semibold text-foreground">17.</span> Any misuse of customization services including fake orders, abusive requests, fraudulent activities, unauthorized copyrighted material, or harmful content submissions may result in account suspension or legal action.</p>
        <p><span className="font-semibold text-foreground">18.</span> Customers acknowledge that handcrafted embroidery and customization processes may create slight artistic uniqueness in every piece, making each customized product individually distinctive.</p>
        <p><span className="font-semibold text-foreground">19.</span> Antariya shall not be responsible for delays caused by customer response delays, approval waiting periods, incomplete customization details, or revision-related interruptions.</p>
        <p><span className="font-semibold text-foreground">20.</span> By placing a customization order with Antariya, customers acknowledge and agree to comply fully with all terms mentioned under this Customization Policy.</p>
      </div>
    ),
  },
  {
    id: "affiliate",
    title: "Affiliate & Collaboration Policy",
    description: "Terms for affiliate partners and collaborators",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya may collaborate with creators, influencers, affiliates, photographers, artists, event organizers, communities, ambassadors, and promotional partners for marketing, branding, and business development purposes.</p>
        <p><span className="font-semibold text-foreground">2.</span> All affiliate, ambassador, sponsorship, promotional, and collaboration activities associated with Antariya must be officially approved through authorized communication channels.</p>
        <p><span className="font-semibold text-foreground">3.</span> Collaborators and affiliates must provide accurate personal, professional, payment, and social media information while applying or working with Antariya.</p>
        <p><span className="font-semibold text-foreground">4.</span> Antariya reserves the right to accept, reject, suspend, terminate, or modify any collaboration, affiliate partnership, or promotional agreement at its sole discretion.</p>
        <p><span className="font-semibold text-foreground">5.</span> Affiliates and collaborators must represent Antariya professionally, ethically, and respectfully across social media platforms, events, campaigns, and public communications.</p>
        <p><span className="font-semibold text-foreground">6.</span> False claims, misleading advertisements, fake promises, manipulated reviews, or unauthorized statements about Antariya products, services, pricing, or brand identity are strictly prohibited.</p>
        <p><span className="font-semibold text-foreground">7.</span> Collaborators must not engage in activities involving hate speech, harassment, illegal content, explicit material, discrimination, scams, or actions that may damage the reputation of Antariya.</p>
        <p><span className="font-semibold text-foreground">8.</span> Any promotional content created for Antariya including photos, videos, captions, reels, designs, or marketing materials must comply with applicable laws, platform rules, and brand guidelines.</p>
        <p><span className="font-semibold text-foreground">9.</span> Antariya reserves the right to request edits, removals, corrections, or modifications to collaboration content that violates brand standards, legal requirements, or platform policies.</p>
        <p><span className="font-semibold text-foreground">10.</span> Affiliates and collaborators may receive commissions, discounts, incentives, products, event access, or promotional benefits according to mutually agreed campaign terms.</p>
        <p><span className="font-semibold text-foreground">11.</span> Commission structures, incentive eligibility, payment timelines, discount codes, referral systems, or campaign rewards may vary depending on partnership type and campaign objectives.</p>
        <p><span className="font-semibold text-foreground">12.</span> Antariya reserves the right to withhold commissions, revoke rewards, suspend payouts, or terminate partnerships in cases involving fraud, fake traffic, fake orders, misuse, policy violations, or suspicious activities.</p>
        <p><span className="font-semibold text-foreground">13.</span> Collaborators may not misuse Antariya logos, branding, embroidery concepts, product visuals, website content, or intellectual property without explicit permission beyond approved promotional activities.</p>
        <p><span className="font-semibold text-foreground">14.</span> Any confidential business information, launch details, pricing strategies, operational plans, customer data, or unreleased product information shared during collaborations must remain confidential unless officially authorized.</p>
        <p><span className="font-semibold text-foreground">15.</span> Affiliates and collaborators are responsible for complying with advertising disclosure laws, sponsorship transparency requirements, taxation obligations, and applicable local regulations.</p>
        <p><span className="font-semibold text-foreground">16.</span> Antariya shall not be responsible for losses, account issues, platform restrictions, audience disputes, copyright claims, or third-party actions faced by collaborators during promotional activities.</p>
        <p><span className="font-semibold text-foreground">17.</span> Collaborators using copyrighted materials, music, artwork, logos, celebrity content, or third-party intellectual property in promotions must ensure they possess proper rights or permissions for usage.</p>
        <p><span className="font-semibold text-foreground">18.</span> Antariya reserves the right to monitor affiliate activities, referral systems, campaign performance, social promotions, and collaboration conduct to maintain brand safety and operational integrity.</p>
        <p><span className="font-semibold text-foreground">19.</span> Any attempt to exploit referral systems, manipulate commissions, generate fake engagement, abuse promotional codes, impersonate Antariya representatives, or conduct fraudulent marketing activities may result in immediate termination and legal action.</p>
        <p><span className="font-semibold text-foreground">20.</span> By participating in affiliate programs, collaborations, partnerships, or promotional campaigns with Antariya, users acknowledge and agree to comply fully with this Affiliate & Collaboration Policy.</p>
      </div>
    ),
  },
  {
    id: "vendor",
    title: "Vendor & Seller Policy",
    description: "Guidelines for vendors and marketplace sellers",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya may allow approved vendors, manufacturers, artists, creators, suppliers, or sellers to collaborate, supply products, or participate in selected business operations through authorized agreements.</p>
        <p><span className="font-semibold text-foreground">2.</span> All vendors and sellers associated with Antariya must provide accurate business information, identity details, contact information, banking details, tax information, and operational documents during onboarding.</p>
        <p><span className="font-semibold text-foreground">3.</span> Vendors and sellers must comply with all applicable local, state, and national laws including taxation, intellectual property regulations, consumer protection laws, and business compliance requirements.</p>
        <p><span className="font-semibold text-foreground">4.</span> Antariya reserves the right to approve, reject, suspend, limit, or terminate any vendor or seller relationship at its sole discretion without prior notice when necessary for operational or legal reasons.</p>
        <p><span className="font-semibold text-foreground">5.</span> Vendors and sellers are responsible for ensuring that supplied products meet agreed quality standards, production specifications, safety requirements, and branding guidelines established by Antariya.</p>
        <p><span className="font-semibold text-foreground">6.</span> Products supplied to Antariya must not contain illegal, harmful, counterfeit, plagiarized, unsafe, offensive, or policy-violating content or materials.</p>
        <p><span className="font-semibold text-foreground">7.</span> Vendors and sellers must ensure that all products, designs, artwork, logos, embroidery patterns, and creative materials supplied do not infringe copyrights, trademarks, patents, or intellectual property rights of third parties.</p>
        <p><span className="font-semibold text-foreground">8.</span> Antariya shall not be responsible for intellectual property disputes, copyright claims, or legal liabilities arising from unauthorized content or materials provided by vendors or sellers.</p>
        <p><span className="font-semibold text-foreground">9.</span> Vendors and sellers are responsible for maintaining product consistency, material quality, packaging standards, timely production, and operational reliability according to agreed requirements.</p>
        <p><span className="font-semibold text-foreground">10.</span> Delays caused by vendors or sellers in production, dispatch, inventory management, raw material supply, customization work, or operational commitments may result in penalties, order restrictions, or partnership review.</p>
        <p><span className="font-semibold text-foreground">11.</span> Vendors and sellers must maintain confidentiality regarding Antariya business information, pricing structures, operational strategies, customer data, unreleased products, and internal communications.</p>
        <p><span className="font-semibold text-foreground">12.</span> Unauthorized disclosure, copying, resale, misuse, or distribution of Antariya designs, concepts, customer data, branding assets, or operational information is strictly prohibited.</p>
        <p><span className="font-semibold text-foreground">13.</span> Antariya reserves the right to conduct quality inspections, operational reviews, verification checks, sample testing, and compliance monitoring to maintain brand standards and customer trust.</p>
        <p><span className="font-semibold text-foreground">14.</span> Vendors and sellers must not engage in fraudulent practices including fake inventory reporting, duplicate product supply, manipulated pricing, false claims, counterfeit production, or unauthorized outsourcing.</p>
        <p><span className="font-semibold text-foreground">15.</span> Payment timelines, commissions, profit-sharing structures, invoices, and settlement procedures shall be governed according to mutually agreed business arrangements between Antariya and the vendor or seller.</p>
        <p><span className="font-semibold text-foreground">16.</span> Antariya reserves the right to withhold payments, suspend settlements, or recover losses in cases involving policy violations, defective products, operational negligence, fraud, customer disputes, or legal issues.</p>
        <p><span className="font-semibold text-foreground">17.</span> Vendors and sellers are responsible for ensuring proper packaging, safe handling, and compliance with shipping standards to minimize damages during logistics and delivery operations.</p>
        <p><span className="font-semibold text-foreground">18.</span> Any activities damaging the reputation, customer trust, operational integrity, or public image of Antariya may result in immediate partnership termination and possible legal action.</p>
        <p><span className="font-semibold text-foreground">19.</span> Vendors and sellers must cooperate during audits, customer complaint investigations, return handling, operational reviews, and dispute resolution processes whenever requested by Antariya.</p>
        <p><span className="font-semibold text-foreground">20.</span> By partnering, supplying products, or operating as a vendor or seller with Antariya, all parties acknowledge and agree to comply fully with this Vendor & Seller Policy.</p>
      </div>
    ),
  },
  {
    id: "community",
    title: "Community Guidelines",
    description: "Standards for platform community interactions",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya aims to build a respectful, creative, inclusive, and positive community for customers, creators, collaborators, supporters, and visitors across all platforms.</p>
        <p><span className="font-semibold text-foreground">2.</span> By interacting with Antariya through the website, social media platforms, events, communities, collaborations, or communication channels, users agree to follow these Community Guidelines.</p>
        <p><span className="font-semibold text-foreground">3.</span> Community members are expected to communicate respectfully and professionally with Antariya representatives, customers, creators, collaborators, delivery personnel, and other users at all times.</p>
        <p><span className="font-semibold text-foreground">4.</span> Hate speech, harassment, bullying, discrimination, threats, abusive language, intimidation, personal attacks, or offensive behavior based on religion, gender, race, nationality, identity, or personal beliefs are strictly prohibited.</p>
        <p><span className="font-semibold text-foreground">5.</span> Users must not share, promote, upload, or distribute illegal, harmful, explicit, violent, misleading, or inappropriate content through Antariya-related platforms or communities.</p>
        <p><span className="font-semibold text-foreground">6.</span> Spam activities including fake promotions, repeated messaging, scams, phishing attempts, unauthorized advertisements, fake giveaways, or misleading links are not allowed.</p>
        <p><span className="font-semibold text-foreground">7.</span> Community members must not impersonate Antariya representatives, employees, collaborators, creators, or other individuals for fraudulent or misleading purposes.</p>
        <p><span className="font-semibold text-foreground">8.</span> Customers and followers are encouraged to provide genuine feedback, constructive criticism, suggestions, reviews, and ideas respectfully without spreading false information or misinformation.</p>
        <p><span className="font-semibold text-foreground">9.</span> Any attempt to manipulate reviews, create fake engagement, spread rumors, damage brand reputation, or intentionally mislead the community may result in restrictions or legal action if necessary.</p>
        <p><span className="font-semibold text-foreground">10.</span> Users must respect the intellectual property, creative work, embroidery concepts, branding assets, product visuals, and original content created by Antariya and associated creators.</p>
        <p><span className="font-semibold text-foreground">11.</span> Unauthorized copying, reposting, resale, misuse, or commercial exploitation of Antariya content, community materials, or creative assets without permission is prohibited.</p>
        <p><span className="font-semibold text-foreground">12.</span> Community members participating in collaborations, ambassador programs, events, or campaigns must maintain ethical conduct and follow all applicable policies and campaign guidelines.</p>
        <p><span className="font-semibold text-foreground">13.</span> Antariya encourages creativity, artistic expression, cultural appreciation, and positive discussions while maintaining a safe and welcoming environment for everyone.</p>
        <p><span className="font-semibold text-foreground">14.</span> Users must not attempt to disrupt platform operations, misuse systems, exploit vulnerabilities, spread malware, or interfere with community activities and website functionality.</p>
        <p><span className="font-semibold text-foreground">15.</span> Personal information, private conversations, customer data, or confidential business information shared within the community must not be leaked, misused, or distributed without authorization.</p>
        <p><span className="font-semibold text-foreground">16.</span> Antariya reserves the right to remove posts, comments, reviews, messages, content, accounts, or community access that violate platform rules, safety standards, or operational guidelines.</p>
        <p><span className="font-semibold text-foreground">17.</span> Repeated violations, fraudulent behavior, abusive conduct, policy manipulation, or harmful activities may result in account suspension, permanent bans, legal notices, or reporting to authorities.</p>
        <p><span className="font-semibold text-foreground">18.</span> Antariya is not responsible for third-party opinions, user-generated content, external community discussions, or unofficial statements made outside officially managed platforms.</p>
        <p><span className="font-semibold text-foreground">19.</span> Community Guidelines apply across all Antariya-related platforms including the website, Instagram pages, WhatsApp groups, Discord servers, events, campaigns, collaborations, and social media interactions.</p>
        <p><span className="font-semibold text-foreground">20.</span> By participating in the Antariya community, users acknowledge and agree to comply fully with these Community Guidelines and all associated platform policies.</p>
      </div>
    ),
  },
  {
    id: "dmca",
    title: "DMCA & Trademark Complaint Policy",
    description: "Process for reporting IP violations",
    content: (
      <div className="space-y-3">
        <p><span className="font-semibold text-foreground">1.</span> Antariya respects intellectual property rights, copyrights, trademarks, and creative ownership belonging to individuals, brands, artists, creators, companies, and organizations.</p>
        <p><span className="font-semibold text-foreground">2.</span> Antariya does not intentionally promote, manufacture, distribute, or sell products that knowingly violate valid copyrights, trademarks, or intellectual property protections.</p>
        <p><span className="font-semibold text-foreground">3.</span> Any copyright owner, trademark owner, authorized representative, creator, or legal authority who believes that their intellectual property rights are being infringed may submit an official complaint to Antariya.</p>
        <p><span className="font-semibold text-foreground">4.</span> Complaints may relate to unauthorized usage of logos, artwork, character designs, embroidery patterns, brand names, product visuals, photographs, creative assets, promotional materials, or copyrighted content displayed on Antariya platforms.</p>
        <p><span className="font-semibold text-foreground">5.</span> All complaints must include sufficient information such as ownership proof, registration details, links or screenshots of the allegedly infringing material, contact information, and a detailed explanation of the complaint.</p>
        <p><span className="font-semibold text-foreground">6.</span> Antariya reserves the right to request additional verification documents, legal evidence, authorization proof, or identity confirmation before processing intellectual property complaints.</p>
        <p><span className="font-semibold text-foreground">7.</span> Upon receiving a valid complaint, Antariya may temporarily remove, restrict, disable, investigate, suspend, or modify the reported content, product listing, design, account, or promotional material.</p>
        <p><span className="font-semibold text-foreground">8.</span> Antariya reserves the right to reject incomplete, misleading, abusive, fraudulent, or unsupported complaints lacking reasonable evidence of ownership or infringement.</p>
        <p><span className="font-semibold text-foreground">9.</span> Users, collaborators, customers, creators, vendors, or sellers submitting artwork, logos, celebrity references, trademarks, or copyrighted materials to Antariya confirm that they possess the necessary legal rights or permissions for such usage.</p>
        <p><span className="font-semibold text-foreground">10.</span> Antariya shall not be held liable for intellectual property violations resulting directly from customer-submitted customization requests, third-party submissions, or unauthorized materials provided by external parties.</p>
        <p><span className="font-semibold text-foreground">11.</span> Counter-notices or dispute responses may be submitted by affected users if they believe reported content was removed mistakenly, unfairly, or under false claims.</p>
        <p><span className="font-semibold text-foreground">12.</span> Antariya reserves the right to review counter-notices, conduct investigations, request legal clarification, and make final decisions regarding restoration or permanent removal of disputed content.</p>
        <p><span className="font-semibold text-foreground">13.</span> Repeated copyright infringement, trademark misuse, counterfeit production, unauthorized resale, fake merchandise creation, or intellectual property abuse may result in account suspension, order cancellation, legal notices, or permanent restrictions.</p>
        <p><span className="font-semibold text-foreground">14.</span> Antariya strictly prohibits unauthorized reproduction, duplication, imitation, resale, redistribution, scraping, or commercial exploitation of its own logos, branding, embroidery concepts, website content, or creative assets.</p>
        <p><span className="font-semibold text-foreground">15.</span> Any misuse of Antariya intellectual property including fake pages, counterfeit products, copied branding, cloned websites, unauthorized advertisements, or misleading impersonation may result in immediate legal enforcement actions.</p>
        <p><span className="font-semibold text-foreground">16.</span> Fan-inspired, cinema-inspired, celebrity-inspired, anime-inspired, sports-inspired, or artistic merchandise created by Antariya is intended as transformative creative expression and does not claim official ownership or endorsement unless explicitly stated.</p>
        <p><span className="font-semibold text-foreground">17.</span> Antariya reserves the right to comply with applicable intellectual property laws, copyright regulations, trademark protections, court orders, and legal enforcement requirements whenever necessary.</p>
        <p><span className="font-semibold text-foreground">18.</span> False intellectual property complaints, malicious reporting, fraudulent ownership claims, or attempts to misuse complaint systems for harassment or anti-competitive purposes may result in legal action.</p>
        <p><span className="font-semibold text-foreground">19.</span> Intellectual property complaints, trademark notices, DMCA notices, or legal concerns must be submitted through Antariya's officially designated communication channels along with proper supporting documentation.</p>
        <p><span className="font-semibold text-foreground">20.</span> By using Antariya platforms, submitting designs, purchasing products, collaborating, or interacting with the brand, users acknowledge and agree to comply fully with this DMCA & Trademark Complaint Policy.</p>
      </div>
    ),
  },
];

export default function PoliciesPage() {
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const policyContentRef = useRef<HTMLDivElement | null>(null);

  const selectedPolicy = policies.find((p) => p.id === openDialog);

  const handleDownloadPdf = () => {
    if (!selectedPolicy || !policyContentRef.current) {
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const headerHeight = 56;
    const footerHeight = 36;
    const contentTop = margin + headerHeight;
    const contentBottom = pageHeight - margin - footerHeight;
    const maxWidth = pageWidth - margin * 2;
    const generatedDate = new Date().toISOString().slice(0, 10);

    const drawHeaderFooter = (pageNumber: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Antariya", margin, margin + 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`Policy Export - ${selectedPolicy.title}`, margin, margin + 30);

      doc.setDrawColor(229, 231, 235);
      doc.line(margin, margin + 38, pageWidth - margin, margin + 38);

      doc.line(margin, pageHeight - margin - 20, pageWidth - margin, pageHeight - margin - 20);
      doc.text(`Generated on ${generatedDate}`, margin, pageHeight - margin - 6);
      doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - margin - 6, { align: "right" });
      doc.setTextColor(0, 0, 0);
    };

    let pageNumber = 1;
    drawHeaderFooter(pageNumber);
    let cursorY = contentTop;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    const titleLines = doc.splitTextToSize(selectedPolicy.title, maxWidth);
    doc.text(titleLines, margin, cursorY);
    cursorY += titleLines.length * 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const rawText = policyContentRef.current.innerText.replace(/\n{3,}/g, "\n\n").trim();
    const lines = doc.splitTextToSize(rawText, maxWidth);
    const lineHeight = 16;

    for (const line of lines) {
      if (cursorY > contentBottom) {
        doc.addPage();
        pageNumber += 1;
        drawHeaderFooter(pageNumber);
        cursorY = contentTop;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    }

    const safeFileName = selectedPolicy.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    doc.save(`${safeFileName || "policy"}-${generatedDate}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-grow py-20">
        <div className="w-full max-w-[1200px] mx-auto px-4">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-2">Policies & Guidelines</h1>
            <p className="text-muted-foreground">
              Click on any policy below to view detailed information. For complete details, visit individual policy pages.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {policies.map((policy) => (
              <button
                key={policy.id}
                onClick={() => setOpenDialog(policy.id)}
                className="text-left p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">{policy.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{policy.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      <Dialog open={!!openDialog} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl">{selectedPolicy?.title}</DialogTitle>
            <DialogDescription className="text-sm">{selectedPolicy?.description}</DialogDescription>
            <div className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </DialogHeader>
          <div ref={policyContentRef} className="mt-6 text-sm text-muted-foreground space-y-4">
            {selectedPolicy?.content}
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
