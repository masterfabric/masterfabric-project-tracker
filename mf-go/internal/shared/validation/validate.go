package validation

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
	domainErr "github.com/masterfabric/masterfabric_go_basic/internal/shared/errors"
)

var validate = validator.New(validator.WithRequiredStructEnabled())

// Struct validates a struct using its `validate` tags and returns a
// DomainError with a VALIDATION_ERROR code on failure.
func Struct(s interface{}) error {
	if err := validate.Struct(s); err != nil {
		if ves, ok := err.(validator.ValidationErrors); ok {
			msgs := make([]string, 0, len(ves))
			for _, fe := range ves {
				msgs = append(msgs, fmt.Sprintf("%s: failed on '%s'", fe.Field(), fe.Tag()))
			}
			return domainErr.New("VALIDATION_ERROR", strings.Join(msgs, "; "), nil)
		}
		return domainErr.New("VALIDATION_ERROR", err.Error(), nil)
	}
	return nil
}
