// Wire up the form for Stripe.
jQuery( document ).ready( function( $ ) {

	var stripe, elements, pmproRequireBilling, cardNumber, cardExpiry, cardCvc;

	// Identify with Stripe.
	stripe = Stripe( pmproStripe.publishableKey );
	elements = stripe.elements();

	// Used by plugns that hide/show the billing fields.
	pmproRequireBilling = true;

	// Create Elements.
	cardNumber = elements.create('cardNumber');
	cardExpiry = elements.create('cardExpiry');
	cardCvc = elements.create('cardCvc');

	// Mount Elements.
	cardNumber.mount('#AccountNumber');
	cardExpiry.mount('#Expiry');
	cardCvc.mount('#CVV');

	// TODO Refactor
	// Handle authentication if required.
	if ( 'undefined' !== typeof( pmproStripe.paymentIntent ) ) {
		if ( 'requires_action' === pmproStripe.paymentIntent.status ) {
			// On submit disable its submit button
			$('input[type=submit]', this).attr('disabled', 'disabled');
			$('input[type=image]', this).attr('disabled', 'disabled');
			$('#pmpro_processing_message').css('visibility', 'visible');
			stripe.handleCardAction( pmproStripe.paymentIntent.client_secret )
				.then( stripeResponseHandler );
		}
	}
	if ( 'undefined' !== typeof( pmproStripe.setupIntent ) ) {
		if ( 'requires_action' === pmproStripe.setupIntent.status ) {
			// On submit disable its submit button
			$('input[type=submit]', this).attr('disabled', 'disabled');
			$('input[type=image]', this).attr('disabled', 'disabled');
			$('#pmpro_processing_message').css('visibility', 'visible');
			stripe.handleCardSetup( pmproStripe.setupIntent.client_secret )
				.then( stripeResponseHandler );
		}
	}

	$( '.pmpro_form' ).submit( function( event ) {
		var billingDetails, paymentMethod;

		// Prevent the form from submitting with the default action.
		event.preventDefault();

		// Double check in case a discount code made the level free.
		if ( pmproRequireBilling ) {

			if ( pmproStripe.verifyAddress ) {
				billingDetails = {
					addressLine1: $( '#baddress1' ).val(),
					addressLine2: $( '#baddress2' ).val(),
					addressCity: $( '#bcity' ).val(),
					addressState: $( '#bstate' ).val(),
					addressZip: $( '#bzipcode' ).val(),
					addressCountry: $( '#bcountry' ).val(),
				};
			}

			//add first and last name if not blank
			if ( $( '#bfirstname' ).length && $( '#blastname' ).length )
				billingDetails['name'] = $.trim( $( '#bfirstname' ).val() + ' ' + $( '#blastname' ).val() );

			// Try creating a PaymentMethod from card element.
			// paymentMethod = stripe.createPaymentMethod( 'card', cardNumber, {
			// 	billingDetails: billingDetails,
			// }).then( stripeResponseHandler );

			source = stripe.createSource( cardNumber, {
				type: 'card',
				billingDetails: billingDetails,
			}).then( stripeResponseHandler );

			// Prevent the form from submitting with the default action.
			return false;
		} else {
			this.submit();
			return true;	//not using Stripe anymore
		}
	});

	// Handle the response from Stripe.
	function stripeResponseHandler( response ) {

		var form, data, card, source, customer;

		form = $('#pmpro_form, .pmpro_form');

		if (response.error) {
			// Re-enable the submit button.
			$('.pmpro_btn-submit-checkout,.pmpro_btn-submit').removeAttr('disabled');

			// Hide processing message.
			$('#pmpro_processing_message').css('visibility', 'hidden');

			$('.pmpro_error').text(response.error.message);

			pmproRequireBilling = true;

			// TODO Handle this better? Let the user know?
			// Delete any incomplete subscriptions if 3DS auth failed.
			data = {
				action: 'delete_incomplete_subscription',
			};
			$.post(pmproStripe.ajaxUrl, data, function (response) {
				// Do stuff?
			});
		} else if ( response.source ) {
			sourceId = response.source.id;
			card = response.source.card;

			// insert the Source ID into the form so it gets submitted to the server
			form.append( '<input type="hidden" name="source_id" value="' + sourceId + '" />' );

			// TODO Get card info for order and user meta after checkout instead.
			//	We need this for now to make sure user meta gets updated.
			// insert fields for other card fields
			if( $( '#CardType[name=CardType]' ).length )
				$( '#CardType' ).val( card.brand );
			else
				form.append( '<input type="hidden" name="CardType" value="' + card.brand + '"/>' );

			form.append( '<input type="hidden" name="AccountNumber" value="XXXXXXXXXXXX' + card.last4 + '"/>' );
			form.append( '<input type="hidden" name="ExpirationMonth" value="' + ( '0' + card.exp_month ).slice( -2 ) + '"/>' );
			form.append( '<input type="hidden" name="ExpirationYear" value="' + card.exp_year + '"/>' );

			// and submit
			form.get(0).submit();
		} else if ( response.paymentIntent || response.setupIntent ) {

		    // TODO Refactor
			if ( pmproStripe.paymentIntent ) {
				customer = pmproStripe.paymentIntent.customer;
				source = pmproStripe.paymentIntent.source;
				form.append( '<input type="hidden" name="payment_intent_id" value="' + pmproStripe.paymentIntent.id + '" />' );
			}
			if ( pmproStripe.setupIntent ) {
				if ( ! customer ) {
					customer = pmproStripe.setupIntent.customer;
				}
				if ( ! source ) {
					source = pmproStripe.setupIntent.source;
				}
				form.append( '<input type="hidden" name="setup_intent_id" value="' + pmproStripe.setupIntent.id + '" />' );
				form.append( '<input type="hidden" name="subscription_id" value="' + pmproStripe.subscription.id + '" />' );
			}

			card = source.card;

			// insert the Customer ID into the form so it gets submitted to the server
			form.append( '<input type="hidden" name="customer_id" value="' + customer.id + '" />' );

			// insert the PaymentMethod ID into the form so it gets submitted to the server
			form.append( '<input type="hidden" name="source_id" value="' + source.id + '" />' );

			// TODO Get card info for order and user meta after checkout instead.
			//	We need this for now to make sure user meta gets updated.
			// insert fields for other card fields
			if( $( '#CardType[name=CardType]' ).length )
				$( '#CardType' ).val( card.brand );
			else
				form.append( '<input type="hidden" name="CardType" value="' + card.brand + '"/>' );

			form.append( '<input type="hidden" name="AccountNumber" value="XXXXXXXXXXXX' + card.last4 + '"/>' );
			form.append( '<input type="hidden" name="ExpirationMonth" value="' + ( '0' + card.exp_month ).slice( -2 ) + '"/>' );
			form.append( '<input type="hidden" name="ExpirationYear" value="' + card.exp_year + '"/>' );
			form.get(0).submit();
			return true;
		}
	}

	// TODO Do we still need this?
	// Validate credit card and set card type.
	$( '#AccountNumber' ).validateCreditCard(function (result) {
		var cardtypenames = {
			"amex": "American Express",
			"diners_club_carte_blanche": "Diners Club Carte Blanche",
			"diners_club_international": "Diners Club International",
			"discover": "Discover",
			"jcb": "JCB",
			"laser": "Laser",
			"maestro": "Maestro",
			"mastercard": "Mastercard",
			"visa": "Visa",
			"visa_electron": "Visa Electron"
		}

		if (result.card_type)
			$( '#CardType' ).val(cardtypenames[result.card_type.name]);
		else
			$( '#CardType' ).val( 'Unknown Card Type' );
	});

});